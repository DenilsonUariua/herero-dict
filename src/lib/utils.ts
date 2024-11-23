import { envConfigs } from "@/configs/env-configs";
import { Word } from "@/hooks/useFetchWords";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const likeWord = async (word: string) => {
  const { apiBaseUrl } = envConfigs;

  try {
    const response = await fetch(`${apiBaseUrl}/api/words/${word}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ incrementLikes: true }), // Pass a flag to indicate the "like" action
    });

    if (!response.ok) {
      throw new Error(`Failed to like the word: ${response.statusText}`);
    }

    const updatedWord = await response.json();
    return updatedWord;
  } catch (error) {
    console.error("Error liking word:", error);
    throw error;
  }
}

export const unlikeWord = async (word: string) => {
  const { apiBaseUrl } = envConfigs;

  try {
    const response = await fetch(`${apiBaseUrl}/api/words/${word}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ decrementLikes: true }), // Pass a flag to indicate the "unlike" action
    });

    if (!response.ok) {
      throw new Error(`Failed to unlike the word: ${response.statusText}`);
    }

    const updatedWord = await response.json();
    return updatedWord;
  } catch (error) {
    console.error("Error unliking word:", error);
    throw error;
  }
}
