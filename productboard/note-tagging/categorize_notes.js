require('dotenv').config();
const axios = require('axios');
const CacheManager = require('./cache-manager');

const PRODUCTBOARD_API = 'https://api.productboard.com';
const OPENAI_API = 'https://api.openai.com/v1/chat/completions';

// Time frame options in milliseconds
const TIME_FRAMES = {
    TODAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000,
    MONTH: 30 * 24 * 60 * 60 * 1000
};

const FEEDBACK_CATEGORIES = [
    {
        name: "Product Usability Feedback",
        description: "Issues with navigation, layout, accessibility, confusing workflows, friction points, or requests for UI/UX improvements"
    },
    {
        name: "Performance and Reliability Feedback",
        description: "Complaints about slowness, crashes, bugs, data syncing issues, or general instability"
    },
    {
        name: "Product Capabilities Feedback",
        description: "Requests for new features, improvements to existing ones, or addressing competitive feature gaps"
    },
    {
        name: "Integrations and API Feedback",
        description: "Issues with existing integrations, requests for new integrations, or API improvements"
    },
    {
        name: "Pricing and Value Perception Feedback",
        description: "Complaints about cost, requests for different pricing tiers or plans, or concerns about ROI"
    },
    {
        name: "Customer Support and Onboarding Feedback",
        description: "Feedback about support quality, onboarding issues, or suggestions for better self-service resources"
    },
    {
        name: "Adoption and Engagement Feedback",
        description: "Barriers to adoption, low engagement, usage drop-offs, or suggestions for improving in-app guidance"
    },
    {
        name: "Competitive Insights Feedback",
        description: "Mentions of competitors, comparisons to competing products, or reasons for switching"
    },
    {
        name: "Compliance and Security Feedback",
        description: "Concerns about data privacy, regulatory compliance, or user access control"
    },
    {
        name: "Non-ICP Feedback",
        description: "Requests or feedback from personas or industries outside of the target audience, or highly custom/edge use cases"
    }
];

// Initialize cache manager
const cache = new CacheManager();

function isWithinTimeFrame(createdAt, timeFrameMs) {
    if (!timeFrameMs) return true; // If no time frame specified, include all notes
    const noteDate = new Date(createdAt);
    const cutoffDate = new Date(Date.now() - timeFrameMs);
    return noteDate >= cutoffDate;
}

async function fetchAndCacheNewNotes(timeFrameMs = null) {
    let totalNewNotes = 0;
    let url = `${PRODUCTBOARD_API}/notes`;
    let batchCount = 0;

    while (url) {
        const res = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${process.env.PRODUCTBOARD_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const notes = res.data.data;
        let foundExisting = false;
        let foundOldNote = false;

        // Process each note in the batch
        for (const note of notes) {
            // Check if note is within time frame
            if (timeFrameMs && !isWithinTimeFrame(note.createdAt, timeFrameMs)) {
                console.log('Found note outside time frame, stopping fetch');
                foundOldNote = true;
                break;
            }

            // If we find a note that's already cached, we can stop
            if (cache.hasNote(note.id)) {
                console.log('Found existing note, stopping fetch as remaining notes should be cached');
                foundExisting = true;
                break;
            }

            // Cache the new note
            const noteData = {
                id: note.id,
                content: note.content,
                title: note.title,
                categories: null, // Will store categories here after processing
                tags: note.tags || [], // Preserve existing tags
                createdAt: note.createdAt
            };
            cache.saveNote(noteData);
            
            console.log(`Caching note ${note.id} (created ${new Date(note.createdAt).toLocaleString()})`);
            totalNewNotes++;
        }

        batchCount++;
        console.log(`Fetched batch ${batchCount}, found ${notes.length} notes, ${totalNewNotes} new notes so far...`);

        // If we found an existing note or old note, stop fetching more pages
        if (foundExisting || foundOldNote) {
            break;
        }

        const pageCursor = res.data?.pageCursor;
        url = pageCursor ? `${PRODUCTBOARD_API}?pageCursor=${pageCursor}` : null;
    }

    return totalNewNotes;
}

async function categorizeNoteFeedbackAndUpdateNote(noteId) {
    const note = cache.getNote(noteId);
    if (!note) return;

    const text = note.content || '';
    if (!text.trim()) return;

    const categories = await categorizeNoteContent(noteId, text);
    
    note.categories = categories;
    cache.saveNote(note);

    if (categories.length) {
        await tagNote(noteId, categories, note.tags);
    }
}

async function categorizeNoteContent(noteId, content) {
    const categoryPrompt = FEEDBACK_CATEGORIES.map((cat, index) => 
        `${index + 1}. ${cat.name} — ${cat.description}`
    ).join('\n    ');

    const prompt = `
    You are a highly skilled product analyst. Your task is to classify product feedback into one or more of the following ten categories, based on the content of the feedback. A piece of feedback may belong to multiple categories.
    
    Feedback Categories:
    
    ${categoryPrompt}
    
    Given the feedback below, return an array of strings of all applicable category names from the list above. If no categories apply, return "None".
    
    Feedback:
    """${content}"""
    
    Output format:
    ["Category Name 1", "Category Name 2", ...]
    `;

    const payload = {
        model: 'gpt-4.1-mini',
        messages: [
            { role: "system", content: "You are a senior product analyst tasked with classifying product feedback based on defined taxonomies." },
            { role: "user", content: prompt }
        ],
        temperature: 0
    };

    const response = await axios.post(OPENAI_API,
        payload,
        {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

    const message = response.data.choices[0].message.content;
    if (message.includes("None")) {
        console.log(`Note ${noteId} has no categories`);
        return [];
    }
    try {
        const categories = JSON.parse(message);
        if (Array.isArray(categories)) {
            console.log(`Note ${noteId} has categories: ${categories}`);
            return categories;
        }
        console.log(`OpenAI response was not an array for note ${noteId}`);
        return [];
    } catch {
        console.error(`Failed to parse categories for note id ${noteId}. Message is ${message}`);
        return [];
    }
}

async function tagNote(noteId, categoryNames, existingTags = []) {
    // Filter out any existing category tags from the list of existing tags
    const nonCategoryTags = existingTags.filter(tag => !isCategoryTag(tag));
    
    // Add new category tags
    const tags = [...nonCategoryTags, ...categoryNames];

    await axios.patch(`${PRODUCTBOARD_API}/notes/${noteId}`, {
        data: {
            tags: tags
        }
    }, {
        headers: {
            'Authorization': `Bearer ${process.env.PRODUCTBOARD_API_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
}

// Helper function to check if a tag is one of our category tags
function isCategoryTag(tag) {
    return FEEDBACK_CATEGORIES.some(category => category.name === tag);
}

async function main() {
    // Get time frame from command line argument
    const timeFrameArg = process.argv[2];
    let timeFrameMs = null;
    
    if (timeFrameArg) {
        timeFrameMs = TIME_FRAMES[timeFrameArg.toUpperCase()];
        if (!timeFrameMs) {
            console.error('Invalid time frame. Use: TODAY, WEEK, or MONTH');
            process.exit(1);
        }
        console.log(`Processing notes from the last ${timeFrameArg.toLowerCase()}`);
    } else {
        console.log('Processing all notes');
    }

    console.log("Phase 1: Fetching and caching new notes...");
    const totalNewNotes = await fetchAndCacheNewNotes(timeFrameMs);
    console.log(`Cached ${totalNewNotes} new notes.`);

    console.log(`Phase 2: Processing uncategorized notes...`);
    const noteIds = cache.getUncategorizedNoteIds();
    console.log(`Found ${noteIds.length} uncategorized notes`);
    
    for (const noteId of noteIds) {
        await categorizeNoteFeedbackAndUpdateNote(noteId);
    }

    console.log("Done processing all new notes.");
}

main().catch(console.error);
