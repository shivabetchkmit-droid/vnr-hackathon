import fs from 'fs';
import path from 'path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { AppSettings, ChatMessage, ChatSession, GeneratedImageRecord, StorageInfo } from '../types';

export class DbService {
  private db: Database | null = null;
  private dbPath: string;
  private userDataPath: string;
  private SQL: SqlJsStatic | null = null;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(userDataPath: string) {
    this.userDataPath = userDataPath;
    const dir = path.join(userDataPath, 'data');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.dbPath = path.join(dir, 'snv_ai.db');
  }

  public async init(): Promise<void> {
    const possibleWasmPaths = [
      path.join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm'),
      path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
      path.join(process.resourcesPath || '', 'sql-wasm.wasm'),
      path.join(process.resourcesPath || '', 'app.asar.unpacked/node_modules/sql.js/dist/sql-wasm.wasm'),
      path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm')
    ];
    let resolvedWasm = '';
    for (const p of possibleWasmPaths) {
      if (p && fs.existsSync(p)) {
        resolvedWasm = p;
        break;
      }
    }
    this.SQL = await initSqlJs(resolvedWasm ? { locateFile: () => resolvedWasm } : undefined);

    if (fs.existsSync(this.dbPath)) {
      try {
        const fileBuffer = fs.readFileSync(this.dbPath);
        this.db = new this.SQL.Database(fileBuffer);
      } catch (e) {
        console.error('Failed to load existing db, creating fresh:', e);
        this.db = new this.SQL.Database();
      }
    } else {
      this.db = new this.SQL.Database();
    }

    this.createTables();
    this.runMigrations();
    this.persistNow();
  }

  private createTables(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        model TEXT NOT NULL,
        mode TEXT NOT NULL,
        pinned INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        model TEXT,
        mode TEXT,
        attachments TEXT,
        image_record TEXT,
        FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        enhanced_prompt TEXT,
        file_path TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        steps INTEGER NOT NULL,
        seed INTEGER NOT NULL,
        model TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        parent_image_id TEXT,
        is_ai_generated INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
    `);
  }

  private runMigrations(): void {
    if (!this.db) return;
    try {
      this.db.run(`ALTER TABLE messages ADD COLUMN image_record TEXT;`);
    } catch {
      // Column may already exist
    }
  }

  private schedulePersist(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.persistNow();
    }, 400);
  }

  public persistNow(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (err) {
      console.error('Error saving SQLite database to disk:', err);
    }
  }

  // Chats CRUD
  public getChats(searchQuery?: string): ChatSession[] {
    if (!this.db) return [];
    try {
      let query = `SELECT id, title, created_at, updated_at, model, mode, pinned FROM chats`;
      const params: any[] = [];

      if (searchQuery && searchQuery.trim()) {
        query += ` WHERE title LIKE ? OR id IN (SELECT DISTINCT chat_id FROM messages WHERE content LIKE ?)`;
        const wild = `%${searchQuery.trim()}%`;
        params.push(wild, wild);
      }

      query += ` ORDER BY updated_at DESC`;

      const stmt = this.db.prepare(query);
      stmt.bind(params);

      const results: ChatSession[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
          id: row.id as string,
          title: row.title as string,
          createdAt: Number(row.created_at),
          updatedAt: Number(row.updated_at),
          model: row.model as string,
          mode: (row.mode as any) || 'general',
          pinned: Boolean(row.pinned)
        });
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('Error fetching chats:', err);
      return [];
    }
  }

  public getChat(id: string): ChatSession | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT id, title, created_at, updated_at, model, mode, pinned FROM chats WHERE id = ? LIMIT 1`);
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        title: row.title as string,
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
        model: row.model as string,
        mode: (row.mode as any) || 'general',
        pinned: Boolean(row.pinned)
      };
    }
    stmt.free();
    return null;
  }

  public saveChat(chat: ChatSession): void {
    if (!this.db) return;
    this.db.run(
      `INSERT OR REPLACE INTO chats (id, title, created_at, updated_at, model, mode, pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [chat.id, chat.title, chat.createdAt, chat.updatedAt, chat.model, chat.mode, chat.pinned ? 1 : 0]
    );
    this.schedulePersist();
  }

  public updateChatTitle(id: string, title: string): void {
    if (!this.db) return;
    this.db.run(`UPDATE chats SET title = ?, updated_at = ? WHERE id = ?`, [title, Date.now(), id]);
    this.schedulePersist();
  }

  public deleteChat(id: string): void {
    if (!this.db) return;
    this.db.run(`DELETE FROM messages WHERE chat_id = ?`, [id]);
    this.db.run(`DELETE FROM chats WHERE id = ?`, [id]);
    this.schedulePersist();
  }

  public clearAllChats(): void {
    if (!this.db) return;
    this.db.run(`DELETE FROM messages`);
    this.db.run(`DELETE FROM chats`);
    this.schedulePersist();
  }

  // Messages CRUD
  public getMessages(chatId: string): ChatMessage[] {
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare(
        `SELECT id, chat_id, role, content, timestamp, model, mode, attachments, image_record
         FROM messages WHERE chat_id = ? ORDER BY timestamp ASC`
      );
      stmt.bind([chatId]);

      const messages: ChatMessage[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        let attachments = [];
        if (row.attachments && typeof row.attachments === 'string') {
          try {
            attachments = JSON.parse(row.attachments);
          } catch {
            attachments = [];
          }
        }
        let imageRecord: GeneratedImageRecord | undefined = undefined;
        if (row.image_record && typeof row.image_record === 'string') {
          try {
            imageRecord = JSON.parse(row.image_record);
          } catch {
            imageRecord = undefined;
          }
        }

        messages.push({
          id: row.id as string,
          chatId: row.chat_id as string,
          role: row.role as any,
          content: row.content as string,
          timestamp: Number(row.timestamp),
          model: (row.model as string) || undefined,
          mode: (row.mode as any) || undefined,
          attachments,
          imageRecord
        });
      }
      stmt.free();
      return messages;
    } catch (err) {
      console.error('Error fetching messages:', err);
      return [];
    }
  }

  public saveMessage(message: ChatMessage): void {
    if (!this.db) return;
    const attachmentsStr = message.attachments ? JSON.stringify(message.attachments) : null;
    const imageRecordStr = message.imageRecord ? JSON.stringify(message.imageRecord) : null;

    this.db.run(
      `INSERT OR REPLACE INTO messages (id, chat_id, role, content, timestamp, model, mode, attachments, image_record)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.chatId,
        message.role,
        message.content,
        message.timestamp,
        message.model || null,
        message.mode || null,
        attachmentsStr,
        imageRecordStr
      ]
    );

    // Update parent chat updated_at
    this.db.run(`UPDATE chats SET updated_at = ? WHERE id = ?`, [Date.now(), message.chatId]);
    this.schedulePersist();
  }

  public updateMessageContent(id: string, content: string): void {
    if (!this.db) return;
    this.db.run(`UPDATE messages SET content = ? WHERE id = ?`, [content, id]);
    this.schedulePersist();
  }

  public deleteMessagesAfter(chatId: string, timestamp: number): void {
    if (!this.db) return;
    this.db.run(`DELETE FROM messages WHERE chat_id = ? AND timestamp > ?`, [chatId, timestamp]);
    this.schedulePersist();
  }

  // Images CRUD
  public saveImageRecord(record: GeneratedImageRecord): void {
    if (!this.db) return;
    this.db.run(
      `INSERT OR REPLACE INTO images (id, prompt, enhanced_prompt, file_path, width, height, steps, seed, model, created_at, parent_image_id, is_ai_generated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.prompt,
        record.enhancedPrompt || null,
        record.filePath,
        record.width,
        record.height,
        record.steps,
        record.seed,
        record.model,
        record.createdAt,
        record.parentImageId || null,
        record.isAiGenerated ? 1 : 0
      ]
    );
    this.schedulePersist();
  }

  public getImageRecords(limit: number = 100, offset: number = 0): GeneratedImageRecord[] {
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare(
        `SELECT id, prompt, enhanced_prompt, file_path, width, height, steps, seed, model, created_at, parent_image_id, is_ai_generated
         FROM images ORDER BY created_at DESC LIMIT ? OFFSET ?`
      );
      stmt.bind([limit, offset]);

      const records: GeneratedImageRecord[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        records.push({
          id: row.id as string,
          prompt: row.prompt as string,
          enhancedPrompt: (row.enhanced_prompt as string) || undefined,
          filePath: row.file_path as string,
          width: Number(row.width),
          height: Number(row.height),
          steps: Number(row.steps),
          seed: Number(row.seed),
          model: row.model as string,
          createdAt: Number(row.created_at),
          parentImageId: (row.parent_image_id as string) || undefined,
          isAiGenerated: Boolean(row.is_ai_generated)
        });
      }
      stmt.free();
      return records;
    } catch (err) {
      console.error('Error fetching image records:', err);
      return [];
    }
  }

  public getImageRecord(id: string): GeneratedImageRecord | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(
        `SELECT id, prompt, enhanced_prompt, file_path, width, height, steps, seed, model, created_at, parent_image_id, is_ai_generated
         FROM images WHERE id = ? LIMIT 1`
      );
      stmt.bind([id]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return {
          id: row.id as string,
          prompt: row.prompt as string,
          enhancedPrompt: (row.enhanced_prompt as string) || undefined,
          filePath: row.file_path as string,
          width: Number(row.width),
          height: Number(row.height),
          steps: Number(row.steps),
          seed: Number(row.seed),
          model: row.model as string,
          createdAt: Number(row.created_at),
          parentImageId: (row.parent_image_id as string) || undefined,
          isAiGenerated: Boolean(row.is_ai_generated)
        };
      }
      stmt.free();
      return null;
    } catch {
      return null;
    }
  }

  public deleteImageRecord(id: string): void {
    if (!this.db) return;
    this.db.run(`DELETE FROM images WHERE id = ?`, [id]);
    this.schedulePersist();
  }

  // Settings
  public getSettings(): Partial<AppSettings> {
    if (!this.db) return {};
    try {
      const stmt = this.db.prepare(`SELECT key, value FROM settings`);
      const settings: any = {};
      while (stmt.step()) {
        const row = stmt.getAsObject();
        try {
          settings[row.key as string] = JSON.parse(row.value as string);
        } catch {
          settings[row.key as string] = row.value;
        }
      }
      stmt.free();
      return settings;
    } catch {
      return {};
    }
  }

  public saveSetting(key: string, value: any): void {
    if (!this.db) return;
    this.db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, JSON.stringify(value)]);
    this.schedulePersist();
  }

  // Storage info
  public getStorageInfo(): StorageInfo {
    if (!this.db) {
      return { chatsCount: 0, messagesCount: 0, dbSizeBytes: 0, dbPath: this.dbPath };
    }

    let chatsCount = 0;
    let messagesCount = 0;
    let imagesCount = 0;

    try {
      const cStmt = this.db.prepare(`SELECT COUNT(*) as count FROM chats`);
      if (cStmt.step()) chatsCount = Number(cStmt.getAsObject().count);
      cStmt.free();

      const mStmt = this.db.prepare(`SELECT COUNT(*) as count FROM messages`);
      if (mStmt.step()) messagesCount = Number(mStmt.getAsObject().count);
      mStmt.free();

      const iStmt = this.db.prepare(`SELECT COUNT(*) as count FROM images`);
      if (iStmt.step()) imagesCount = Number(iStmt.getAsObject().count);
      iStmt.free();
    } catch {
      // ignore
    }

    let dbSizeBytes = 0;
    try {
      if (fs.existsSync(this.dbPath)) {
        dbSizeBytes = fs.statSync(this.dbPath).size;
      }
    } catch {
      // ignore
    }

    let imagesSizeBytes = 0;
    try {
      const imagesDir = path.join(this.userDataPath, 'images');
      if (fs.existsSync(imagesDir)) {
        const files = fs.readdirSync(imagesDir);
        for (const file of files) {
          imagesSizeBytes += fs.statSync(path.join(imagesDir, file)).size;
        }
      }
    } catch {
      // ignore
    }

    return {
      chatsCount,
      messagesCount,
      dbSizeBytes,
      dbPath: this.dbPath,
      imagesCount,
      imagesSizeBytes
    };
  }
}
