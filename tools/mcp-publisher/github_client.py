"""GitHub API client for creating and listing Jekyll posts in the _posts folder."""

import base64
import httpx


GITHUB_API = "https://api.github.com"


class GitHubClient:
    def __init__(self, token: str, owner: str, repo: str):
        self.token = token
        self.owner = owner
        self.repo = repo
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def create_post(self, filename: str, content: str, commit_message: str | None = None) -> dict:
        """Commit a new markdown file to the _posts directory."""
        path = f"_posts/{filename}"
        if commit_message is None:
            commit_message = f"chore: add post {filename} via Telegram bot"

        encoded = base64.b64encode(content.encode("utf-8")).decode("utf-8")

        with httpx.Client(timeout=30) as client:
            resp = client.put(
                f"{GITHUB_API}/repos/{self.owner}/{self.repo}/contents/{path}",
                headers=self._headers,
                json={"message": commit_message, "content": encoded},
            )
            resp.raise_for_status()
            return resp.json()

    def list_posts(self, limit: int = 10) -> list[dict]:
        """Return the most recent posts sorted by filename (newest first)."""
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"{GITHUB_API}/repos/{self.owner}/{self.repo}/contents/_posts",
                headers=self._headers,
            )
            resp.raise_for_status()
            files = resp.json()

        files = sorted(
            [f for f in files if f["name"].endswith(".md")],
            key=lambda x: x["name"],
            reverse=True,
        )[:limit]

        return [
            {"name": f["name"], "path": f["path"], "html_url": f["html_url"]}
            for f in files
        ]

    def get_post(self, filename: str) -> dict:
        """Fetch the raw markdown content of an existing post."""
        path = f"_posts/{filename}"
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"{GITHUB_API}/repos/{self.owner}/{self.repo}/contents/{path}",
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()

        content = base64.b64decode(data["content"]).decode("utf-8")
        return {"filename": filename, "sha": data["sha"], "content": content}

    def upload_image(self, filename: str, image_bytes: bytes, commit_message: str | None = None) -> str:
        """
        Upload a PNG/JPG to assets/img/thumbnails/<filename> and return the
        public GitHub Pages URL for the image.
        """
        path = f"assets/img/thumbnails/{filename}"
        if commit_message is None:
            commit_message = f"chore: add thumbnail {filename} via Telegram bot"

        encoded = base64.b64encode(image_bytes).decode("utf-8")

        with httpx.Client(timeout=60) as client:
            resp = client.put(
                f"{GITHUB_API}/repos/{self.owner}/{self.repo}/contents/{path}",
                headers=self._headers,
                json={"message": commit_message, "content": encoded},
            )
            resp.raise_for_status()

        return f"assets/img/thumbnails/{filename}"

    def delete_file(self, path: str, sha: str, commit_message: str | None = None) -> dict:
        """
        Delete a file from the repository by path and its current blob SHA.
        Use get_post() or the sha returned by create_post() to obtain the SHA.
        """
        if commit_message is None:
            commit_message = f"revert: remove {path} via Telegram bot"

        with httpx.Client(timeout=30) as client:
            resp = client.delete(
                f"{GITHUB_API}/repos/{self.owner}/{self.repo}/contents/{path}",
                headers=self._headers,
                json={"message": commit_message, "sha": sha},
            )
            resp.raise_for_status()
            return resp.json()
