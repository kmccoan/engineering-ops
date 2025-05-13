const fs = require('fs');
const path = require('path');

class CacheManager {
    constructor(cacheDir = './cache') {
        this.cacheDir = cacheDir;
        this.indexFile = path.join(this.cacheDir, 'notes_index.json');
        this.notesIndex = {};
        
        this.initializeCache();
    }

    initializeCache() {
        // Ensure cache directory exists
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir);
        }

        // Load existing index if it exists
        if (fs.existsSync(this.indexFile)) {
            this.notesIndex = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
        }
    }

    saveIndex() {
        fs.writeFileSync(this.indexFile, JSON.stringify(this.notesIndex, null, 2));
    }

    getNote(noteId) {
        const noteInfo = this.notesIndex[noteId];
        if (!noteInfo) return null;
        
        try {
            const notePath = path.join(this.cacheDir, `${noteId}.json`);
            if (fs.existsSync(notePath)) {
                return JSON.parse(fs.readFileSync(notePath, 'utf8'));
            }
        } catch (error) {
            console.error(`Error reading cached note ${noteId}:`, error);
        }
        return null;
    }

    saveNote(note) {
        const noteId = note.id;
        const notePath = path.join(this.cacheDir, `${noteId}.json`);
        
        // Save note data
        fs.writeFileSync(notePath, JSON.stringify(note, null, 2));
        
        // Update index
        this.notesIndex[noteId] = {
            createdAt: note.createdAt,
            categories: note.categories
        };
        this.saveIndex();
    }

    getUncategorizedNoteIds() {
        return Object.entries(this.notesIndex)
            .filter(([_, info]) => info.categories === null)
            .map(([noteId]) => noteId);
    }

    hasNote(noteId) {
        return this.getNote(noteId) !== null;
    }
}

module.exports = CacheManager; 