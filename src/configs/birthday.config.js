/**
 * Birthday Feature Configuration
 */

export const BIRTHDAY_CONFIG = {
  // Timezone cho Vietnam
  TIMEZONE: 'Asia/Ho_Chi_Minh',

  // Format ngay thang
  DATE_FORMAT: 'DD/MM',
  FULL_DATE_FORMAT: 'DD/MM/YYYY',

  // Database
  DATABASE_NAME: 'BCN',
  COLLECTION_NAME: 'members',

  // Regex pattern de validate date format DD/MM
  DATE_PATTERN: /^\d{2}\/\d{2}$/,

  // API response messages
  MESSAGES: {
    SUCCESS: 'Request completed successfully',
    ERROR: 'An error occurred',
    INVALID_DATE: 'Invalid date format. Expected DD/MM (e.g., "24/01")',
    MISSING_DATE: 'Field "date" is required in request body',
    NO_BIRTHDAYS: 'No members found with birthday on this date'
  }
};
