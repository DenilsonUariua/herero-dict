import { envConfigs } from "@/configs/env-configs";
import { Word } from "@/hooks/useFetchWords";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Client, Databases, Query } from 'appwrite';

const client = new Client()
  .setEndpoint(envConfigs.appwriteEndpoint)
  .setProject(envConfigs.appwriteProjectId);

const databases = new Databases(client);

const DATABASE_ID = envConfigs.appwriteDatabaseId; // Replace with your Appwrite Database ID
const COLLECTION_ID = envConfigs.appwriteCollectionId; // Replace with your Appwrite Collection ID

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const likeWord = async (wordId: string) => {
  try {
    const currentWord = await databases.getDocument(DATABASE_ID, COLLECTION_ID, wordId);
    const updatedLikes = currentWord.likes + 1;

    const updatedWord = await databases.updateDocument(
      DATABASE_ID,
      COLLECTION_ID,
      wordId,
      { likes: updatedLikes }
    );
    return updatedWord;
  } catch (error) {
    console.error("Error liking word:", error);
    throw error;
  }
};

export const unlikeWord = async (wordId: string) => {
  try {
    const currentWord = await databases.getDocument(DATABASE_ID, COLLECTION_ID, wordId);
    const updatedLikes = currentWord.likes - 1;

    const updatedWord = await databases.updateDocument(
      DATABASE_ID,
      COLLECTION_ID,
      wordId,
      { likes: updatedLikes }
    );
    return updatedWord;
  } catch (error) {
    console.error("Error unliking word:", error);
    throw error;
  }
};
