import { Client, Databases, ID } from 'appwrite';
import { envConfigs } from '@/configs/env-configs';

const client = new Client();
client
  .setEndpoint(envConfigs.appwriteEndpoint)
  .setProject(envConfigs.appwriteProjectId);

const databases = new Databases(client);

export { client, databases, ID };