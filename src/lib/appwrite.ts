import { Client, Account, TablesDB, ID } from 'appwrite';
import { envConfigs } from '@/configs/env-configs';

const client = new Client();
client
  .setEndpoint(envConfigs.appwriteEndpoint)
  .setProject(envConfigs.appwriteProjectId);

const account = new Account(client);
const tables = new TablesDB(client);

export { client, account, tables, ID };
