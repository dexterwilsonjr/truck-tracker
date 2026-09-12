"""Reserve the dedicated Tracker site. Does not publish a release."""
import json
import subprocess
import urllib.request
import urllib.error
project = "windies-app"
site = "windies-truck-tracker"
token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
headers = {"Authorization": "Bearer " + token, "x-goog-user-project": project, "Content-Type": "application/json"}
url = f"https://firebasehosting.googleapis.com/v1beta1/projects/{project}/sites?siteId={site}"
request = urllib.request.Request(url, data=json.dumps({}).encode(), headers=headers, method="POST")
try:
    result = json.load(urllib.request.urlopen(request))
    print("Reserved hosting site:", result.get("defaultUrl"))
except urllib.error.HTTPError as error:
    if error.code == 409:
        print("Site already exists; inspect ownership before deploying.")
    else:
        print("Hosting reservation failed:", error.code, error.read().decode())
        raise SystemExit(1)
