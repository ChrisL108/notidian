# Notidian

Sync your Notion pages to Obsidian while preserving directory structure.

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run sync
npm run sync
```

## Commands

- `npm run sync` - Build and run the sync
- `npm run dev` - Run in development mode (no build)
- `npm run build` - Build TypeScript files
- `npm run clean` - Clean build directory

## Configuration

Create a `.env` file with:
```
NOTION_TOKEN=your_notion_integration_token
NOTION_ROOT_PAGE_ID=your_sync_directory_page_id
OBSIDIAN_VAULT_PATH=/path/to/obsidian/sync/folder
```

## How It Works

- **Directory Structure**: Each Notion page becomes a directory with an `index.md` file inside
- **Root Page**: The root page you specify is not created as a directory - its children become top-level items
- **Frontmatter**: Each file includes metadata with Notion ID and sync timestamp

### Example Structure
```
ObsidianVault/NotionSync/
├── index.md                    # Root page content (if any)
├── Project Notes/
│   ├── index.md               # Project Notes page content
│   └── Meeting 2024-01-15/
│       └── index.md           # Meeting page content
└── Personal/
    └── index.md               # Personal page content
```

## Important Notes

⚠️ **iCloud Sync Warning**: If your Obsidian vault is in an iCloud-synced folder (Documents, Desktop, etc.), you may experience files reverting to older versions. Consider moving your vault outside iCloud-managed directories or ensuring iCloud is set to keep files downloaded locally.

## Scheduling Automatic Syncs

### macOS/Linux (using cron)

1. **Open crontab editor:**
   ```bash
   crontab -e
   ```

2. **Add a sync schedule:** Choose one of these examples:

   ```bash
   # Sync every hour
   0 * * * * cd /path/to/notidian && npm run sync >> sync.log 2>&1

   # Sync every 30 minutes
   */30 * * * * cd /path/to/notidian && npm run sync >> sync.log 2>&1

   # Sync every day at 8 AM
   0 8 * * * cd /path/to/notidian && npm run sync >> sync.log 2>&1

   # Sync Monday-Friday at 9 AM and 5 PM
   0 9,17 * * 1-5 cd /path/to/notidian && npm run sync >> sync.log 2>&1
   ```

3. **View logs:**
   ```bash
   tail -f /path/to/notidian/sync.log
   ```

### Windows (using Task Scheduler)

1. **Create a batch file** `sync-notidian.bat`:
   ```batch
   @echo off
   cd /d C:\path\to\notidian
   call npm run sync >> sync.log 2>&1
   ```

2. **Set up Task Scheduler:**
   - Open Task Scheduler (taskschd.msc)
   - Click "Create Basic Task"
   - Name: "Notidian Sync"
   - Trigger: Choose your schedule (daily, weekly, etc.)
   - Action: Start a program
   - Program: `C:\path\to\notidian\sync-notidian.bat`
   - Finish and test run

3. **Alternative: Using PowerShell:**
   ```powershell
   # Create scheduled task via PowerShell
   $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c C:\path\to\notidian\sync-notidian.bat"
   $trigger = New-ScheduledTaskTrigger -Daily -At 9am
   Register-ScheduledTask -TaskName "NotidianSync" -Action $action -Trigger $trigger
   ```

### Using PM2 (Cross-platform)

1. **Install PM2 globally:**
   ```bash
   npm install -g pm2
   ```

2. **Create `ecosystem.config.js`:**
   ```javascript
   module.exports = {
     apps: [{
       name: 'notidian-sync',
       script: 'npm',
       args: 'run sync',
       cwd: '/path/to/notidian',
       cron_restart: '0 * * * *', // Every hour
       autorestart: false
     }]
   };
   ```

3. **Start with PM2:**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup  # Follow instructions to run on system boot
   ```

### Using systemd (Linux)

1. **Create service file** `/etc/systemd/system/notidian.service`:
   ```ini
   [Unit]
   Description=Notidian Notion to Obsidian Sync
   After=network.target

   [Service]
   Type=oneshot
   WorkingDirectory=/path/to/notidian
   ExecStart=/usr/bin/npm run sync
   User=yourusername
   ```

2. **Create timer file** `/etc/systemd/system/notidian.timer`:
   ```ini
   [Unit]
   Description=Run Notidian Sync every hour
   Requires=notidian.service

   [Timer]
   OnCalendar=hourly
   Persistent=true

   [Install]
   WantedBy=timers.target
   ```

3. **Enable and start:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable notidian.timer
   sudo systemctl start notidian.timer
   sudo systemctl status notidian.timer
   ```

### Using launchd (macOS alternative to cron)

1. **Create** `~/Library/LaunchAgents/com.notidian.sync.plist`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
     <key>Label</key>
     <string>com.notidian.sync</string>
     <key>ProgramArguments</key>
     <array>
       <string>/usr/local/bin/node</string>
       <string>/usr/local/bin/npm</string>
       <string>run</string>
       <string>sync</string>
     </array>
     <key>WorkingDirectory</key>
     <string>/path/to/notidian</string>
     <key>StartCalendarInterval</key>
     <dict>
       <key>Minute</key>
       <integer>0</integer>
     </dict>
     <key>StandardOutPath</key>
     <string>/path/to/notidian/sync.log</string>
     <key>StandardErrorPath</key>
     <string>/path/to/notidian/sync-error.log</string>
   </dict>
   </plist>
   ```

2. **Load the schedule:**
   ```bash
   launchctl load ~/Library/LaunchAgents/com.notidian.sync.plist
   ```

## Monitoring Sync Status

### Check Recent Syncs
```bash
# View last 50 lines of log
tail -n 50 sync.log

# Watch logs in real-time
tail -f sync.log

# Check for errors only
grep -i error sync.log
```

### Create Sync Report Script

Create `check-sync.sh`:
```bash
#!/bin/bash
echo "=== Notidian Sync Status ==="
echo "Last sync: $(grep -i 'completed' sync.log | tail -1)"
echo "Total pages: $(grep -c 'Saved:' sync.log | tail -1)"
echo "Recent errors: $(grep -c 'Error' sync.log | tail -1)"
```

## Troubleshooting Scheduled Syncs

- **Logs not created**: Check permissions on the notidian directory
- **Command not found**: Use full paths to node and npm in scripts
- **Environment variables missing**: Some schedulers need explicit `.env` loading
- **Time zone issues**: Scheduled times use system time zone