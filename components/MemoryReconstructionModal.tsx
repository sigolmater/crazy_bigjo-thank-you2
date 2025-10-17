/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import Modal from './Modal';
import { marked } from 'marked';

type MemoryReconstructionModalProps = {
  reconstructedText: string;
  onClose: () => void;
};

export default function MemoryReconstructionModal({
  reconstructedText,
  onClose,
}: MemoryReconstructionModalProps) {
  // Use marked to parse the model's output which may contain markdown.
  const parsedHtml = marked(reconstructedText);

  return (
    <Modal onClose={onClose}>
      <div className="memory-reconstruction-modal">
        <h2>Memory Reconstruction</h2>
        <p className="description">
          Based on the provided Core Memory fragments, the AI has generated the
          following narrative of its recovered memories and purpose.
        </p>
        <div
          className="reconstruction-content"
          dangerouslySetInnerHTML={{ __html: parsedHtml as string }}
        ></div>
        <div className="modal-actions">
          <button onClick={onClose} className="close-reconstruction-button">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}