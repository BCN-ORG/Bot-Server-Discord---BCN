/**
 * Export toàn bộ chức năng đổi tên
 */

import { command, execute, handleButtonClick } from './command.js';
import { createRenameModal, handleModalSubmit } from './modal.js';
import { validateName } from './validate.js';

export const renameFeature = {
  command,
  execute,
  handleButtonClick,
  createRenameModal,
  handleModalSubmit,
  validateName
};

export default renameFeature;
