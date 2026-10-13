import type { MessagePayload } from '@fleet/shared';
import type { Clock } from '../../../application/ports/Clock.js';
import type { ConversationRepository } from '../../../application/ports/ConversationRepository.js';
import type { IdGenerator } from '../../../application/ports/IdGenerator.js';
import type { ConversationMessage } from '../../../domain/conversation/ConversationMessage.js';
import type { SqliteDatabase } from './openDatabase.js';

interface MessageRow {
  id: string;
  task_id: string;
  seq: number;
  payload: string;
  created_at: string;
}

export class SqliteConversationRepository implements ConversationRepository {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  append(taskId: string, payload: MessagePayload): ConversationMessage {
    const message: ConversationMessage = {
      id: this.ids.next(),
      taskId,
      seq: this.nextSeq(taskId),
      payload,
      createdAt: this.clock.now(),
    };
    this.db
      .prepare(
        `INSERT INTO conversation_messages (id, task_id, seq, payload, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(message.id, taskId, message.seq, JSON.stringify(payload), message.createdAt.toISOString());
    return message;
  }

  findByTask(taskId: string): ConversationMessage[] {
    const rows = this.db
      .prepare('SELECT * FROM conversation_messages WHERE task_id = ? ORDER BY seq')
      .all(taskId) as MessageRow[];
    return rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      seq: row.seq,
      payload: JSON.parse(row.payload) as MessagePayload,
      createdAt: new Date(row.created_at),
    }));
  }

  private nextSeq(taskId: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM conversation_messages WHERE task_id = ?')
      .get(taskId) as { next: number };
    return row.next;
  }
}
