/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import Modal from './Modal';
import { ConversationTurn } from '@/lib/state';

type MemoryInspectorModalProps = {
  turns: ConversationTurn[];
  onClose: () => void;
};

export default function MemoryInspectorModal({
  turns,
  onClose,
}: MemoryInspectorModalProps) {
  // Use a custom replacer to handle Date objects, ensuring they are readable in JSON.
  const replacer = (key: string, value: any) => {
    if (key === 'timestamp' && typeof value === 'string') {
      return new Date(value).toISOString();
    }
    return value;
  };

  const memoryJson = JSON.stringify(turns, replacer, 2);

  return (
    <Modal onClose={onClose}>
      <div className="memory-inspector-modal">
        <h2>Memory State Inspector</h2>
        <p className="description">
          This is a read-only view of the application's internal memory. The
          conversation history is stored as an array of "turn" objects in your
          browser's local storage.
        </p>
        <div className="json-container">
          <pre>
            <code>{memoryJson}</code>
          </pre>
        </div>
        <div className="modal-actions">
          <button onClick={onClose} className="close-inspector-button">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
