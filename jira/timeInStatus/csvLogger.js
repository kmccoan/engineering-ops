import fs from 'fs';
import { AsyncParser } from '@json2csv/node';

export function writeToCSV(filePath, headers, data, asyncParserOpts) {
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        fs.unlinkSync(filePath)
    } catch (err) {
        // Do nothing - there's no file yet.
    } 

    const writableStream = fs.createWriteStream(filePath);
    const parser = new AsyncParser({
        defaultValue: 0,
        fields: headers,
        ...asyncParserOpts
    }, {}, {});

    parser.parse(data).pipe(writableStream);
}
