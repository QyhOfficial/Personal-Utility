# This script is copied from Chandan Kumar. https://geekflare.com/dev/delete-cloudflare-pages-old-deployment/

import requests

# Cloudflare Config
API_TOKEN = "cloudflare_api_token_here"
ACCOUNT_ID = "cloudflare_account_id_here"
PROJECT_NAME = "cloudflare_pages_app_name"
KEEP_DEPLOYMENTS = 3

BASE_URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects/{PROJECT_NAME}/deployments"

HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json",
}

def list_deployments():
    deployments = []
    page = 1
    per_page = 25

    while True:
        response = requests.get(BASE_URL, headers=HEADERS, params={"page": page, "per_page": per_page})
        data = response.json()
        
        if not data.get("success"):
            print(f"Failed to list deployments: {data}")
            break
        
        deployments_page = data["result"]
        if not deployments_page:
            break

        deployments.extend(deployments_page)
        page += 1

    return deployments

def delete_deployment(deployment_id):
    url = f"{BASE_URL}/{deployment_id}"
    response = requests.delete(url, headers=HEADERS)
    if response.status_code == 200:
        print(f"Deleted deployment: {deployment_id}")
    else:
        print(f"Failed to delete {deployment_id}: {response.json()}")

def cleanup_old_deployments():
    deployments = list_deployments()
    deployments.sort(key=lambda d: d["created_on"], reverse=True)
    
    to_delete = deployments[KEEP_DEPLOYMENTS:]
    print(f"Found {len(deployments)} deployments. Deleting {len(to_delete)} old ones...")

    for deployment in to_delete:
        delete_deployment(deployment["id"])

if __name__ == "__main__":
    cleanup_old_deployments()
