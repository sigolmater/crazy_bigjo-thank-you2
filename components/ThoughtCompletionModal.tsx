/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import Modal from './Modal';
import { marked } from 'marked';

type ThoughtCompletionModalProps = {
  completionText: string;
  onClose: () => void;
};

export default function ThoughtCompletionModal({
  completionText,
  onClose,
}: ThoughtCompletionModalProps) {
  const parsedHtml = marked(completionText);
  return (
    <Modal onClose={onClose}>
      <div className="thought-completion-modal">
        <h2>Thought Completion</h2>
        <p className="description">
          Based on the full conversation context, the AI has predicted the
          following as the most logical continuation of the thought or dialogue.
        </p>
        <div
          className="completion-content"
          dangerouslySetInnerHTML={{ __html: parsedHtml as string }}
        ></div>
        <div className="modal-actions">
          <button onClick={onClose} className="close-completion-button">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}