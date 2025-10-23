import json
import csv
import os

json_file_path = 'c:\\Users\\Denilson\\OneDrive - TDW\\Documents\\Work\\Projects\\Websites\\herero-dict\\words.json'
csv_file_path = 'c:\\Users\\Denilson\\OneDrive - TDW\\Documents\\Work\\Projects\\Websites\\herero-dict\\words.csv'

# Ensure the JSON file exists
if not os.path.exists(json_file_path):
    print(f"Error: JSON file not found at {json_file_path}")
    exit(1)

try:
    with open(json_file_path, 'r', encoding='utf-8') as json_file:
        data = json.load(json_file)
except json.JSONDecodeError as e:
    print(f"Error decoding JSON from {json_file_path}: {e}")
    exit(1)
except Exception as e:
    print(f"Error reading JSON file {json_file_path}: {e}")
    exit(1)

if not data:
    print("JSON file is empty or contains no data.")
    exit(0)

# Assuming data is a list of dictionaries
if isinstance(data, list) and all(isinstance(item, dict) for item in data):
    headers = data[0].keys()
    try:
        with open(csv_file_path, 'w', newline='', encoding='utf-8') as csv_file:
            writer = csv.writer(csv_file)
            writer.writerow(headers)  # Write headers
            for item in data:
                writer.writerow(item.values())
        print(f"Successfully converted {json_file_path} to {csv_file_path}")
    except Exception as e:
        print(f"Error writing CSV file {csv_file_path}: {e}")
        exit(1)
else:
    print("JSON data is not in the expected format (list of dictionaries).")
    exit(1)