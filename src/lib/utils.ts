import { envConfigs } from "@/configs/env-configs";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Client, Databases } from 'appwrite';

const client = new Client()
  .setEndpoint(envConfigs.appwriteEndpoint)
  .setProject(envConfigs.appwriteProjectId);

const databases = new Databases(client);

const DATABASE_ID = envConfigs.appwriteDatabaseId;
const COLLECTION_ID = envConfigs.appwriteCollectionId;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const likeWord = async (wordId: string, currentLikes: number) => {
  try {
    // Verify user is authenticated
  
    const updatedWord = await databases.updateDocument(
      DATABASE_ID,
      COLLECTION_ID,
      wordId,
      { likes: currentLikes + 1 }
    );
    return updatedWord;
  } catch (error) {
    console.error("Error liking word:", error);
    throw error;
  }
};

export const unlikeWord = async (wordId: string, currentLikes: number) => {
  try {
    const updatedWord = await databases.updateDocument(
      DATABASE_ID,
      COLLECTION_ID,
      wordId,
      { likes: currentLikes - 1 }
    );
    return updatedWord;
  } catch (error) {
    console.error("Error unliking word:", error);
    throw error;
  }
};