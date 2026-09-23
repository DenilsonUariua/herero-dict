export const envConfigs = {
  appwriteEndpoint: import.meta.env.VITE_APPWRITE_ENDPOINT,
  appwriteProjectId: import.meta.env.VITE_APPWRITE_PROJECT_ID,
  appwriteDatabaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID,
  // Table IDs
  appwriteCollectionId: import.meta.env.VITE_APPWRITE_COLLECTION_ID ?? 'words',
  appwriteMessagesTableId: import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID ?? 'messages',
  appwriteLanguagesTableId: import.meta.env.VITE_APPWRITE_LANGUAGES_TABLE_ID ?? 'languages',
  appwriteTranslationsTableId: import.meta.env.VITE_APPWRITE_TRANSLATIONS_TABLE_ID ?? 'translations',
  appwriteSuggestionsTableId: import.meta.env.VITE_APPWRITE_SUGGESTIONS_TABLE_ID ?? 'word_suggestions',
  appwriteCorrectionsTableId: import.meta.env.VITE_APPWRITE_CORRECTIONS_TABLE_ID ?? 'word_corrections',
  appwriteLikesTableId: import.meta.env.VITE_APPWRITE_LIKES_TABLE_ID ?? 'word_likes',
  appwriteProfilesTableId: import.meta.env.VITE_APPWRITE_PROFILES_TABLE_ID ?? 'profiles',
  appwriteWotdTableId: import.meta.env.VITE_APPWRITE_WOTD_TABLE_ID ?? 'word_of_the_day',
  appwriteDraftsTableId: import.meta.env.VITE_APPWRITE_DRAFTS_TABLE_ID ?? 'word_drafts',
  appwriteSettingsTableId: import.meta.env.VITE_APPWRITE_SETTINGS_TABLE_ID ?? 'app_settings',
} as const;
