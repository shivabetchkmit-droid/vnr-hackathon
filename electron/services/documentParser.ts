import fs from 'fs';
import path from 'path';

export interface ParsedDocument {
  name: string;
  path: string;
  size: number;
  text: string;
  extension: string;
}

export class DocumentParser {
  public static async parseFile(filePath: string): Promise<ParsedDocument> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const name = path.basename(filePath);

    let extractedText = '';

    if (ext === '.pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        extractedText = data.text || '';
      } catch (err: any) {
        throw new Error(`Failed to parse PDF document: ${err.message}`);
      }
    } else if (ext === '.docx') {
      try {
        const mammoth = require('mammoth');
        const buffer = fs.readFileSync(filePath);
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value || '';
      } catch (err: any) {
        throw new Error(`Failed to parse DOCX document: ${err.message}`);
      }
    } else {
      // Text, Markdown, CSV, JSON, Source Code
      try {
        extractedText = fs.readFileSync(filePath, 'utf-8');
      } catch (err: any) {
        throw new Error(`Failed to read file as text: ${err.message}`);
      }
    }

    return {
      name,
      path: filePath,
      size: stat.size,
      text: extractedText,
      extension: ext
    };
  }
}
