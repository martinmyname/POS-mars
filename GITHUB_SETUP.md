# Push POS to GitHub (Separate Repository)

The `pos` folder is now initialized as its own Git repository, separate from the parent `MarsKitchenEssentialsEcommerce` project.

## Step 1: Configure Git (if not already done)

If you haven't set your Git identity yet, run these commands **in the `pos` folder**:

```powershell
cd c:\Users\Dell\Downloads\eMars\MarsKitchenEssentialsEcommerce\pos
git config user.email "your-email@example.com"
git config user.name "Your Name"
```

Or set it globally for all repos:

```powershell
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"
```

## Step 2: Create Initial Commit

```powershell
cd c:\Users\Dell\Downloads\eMars\MarsKitchenEssentialsEcommerce\pos
git commit -m "Initial commit: Mars Kitchen Essentials POS - offline-first PWA"
```

## Step 3: Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. **Repository name:** `mars-kitchen-pos` (or any name you prefer)
3. **Description:** "Offline-first POS system for Mars Kitchen Essentials"
4. **Visibility:** Choose Public or Private
5. **Do NOT** initialize with README, .gitignore, or license (we already have these)
6. Click **Create repository**

## Step 4: Connect and Push

After creating the repo, GitHub will show you commands. Use these (replace `YOUR_USERNAME` and `YOUR_REPO_NAME`):

```powershell
cd c:\Users\Dell\Downloads\eMars\MarsKitchenEssentialsEcommerce\pos
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## Step 5: Verify

- Go to your GitHub repo page
- You should see all your POS files
- **Important:** Make sure `.env` is NOT visible (it should be ignored)

## Next Steps

After pushing to GitHub, you can deploy the POS online. See [DEPLOY.md](./DEPLOY.md) for hosting instructions (Vercel, Netlify, etc.).

---

**Note:** The parent `MarsKitchenEssentialsEcommerce` repository remains unchanged. The `pos` folder now has its own independent Git history.
