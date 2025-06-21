import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

interface PageInfo {
  id: string;
  title: string;
  path: string[];
}

class NotidianSync {
  private notion: Client;
  private n2m: NotionToMarkdown;
  private rootPageId: string;
  private obsidianPath: string;

  constructor() {
    const notionToken = process.env.NOTION_TOKEN;
    const rootPageId = process.env.NOTION_ROOT_PAGE_ID;
    const obsidianPath = process.env.OBSIDIAN_VAULT_PATH;

    if (!notionToken || !rootPageId || !obsidianPath) {
      throw new Error('Missing required environment variables. Please check your .env file.');
    }

    this.notion = new Client({ auth: notionToken });
    this.n2m = new NotionToMarkdown({ notionClient: this.notion });
    this.rootPageId = rootPageId;
    this.obsidianPath = obsidianPath;
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.error(`Error creating directory ${dirPath}:`, error);
    }
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async getPageTitle(pageId: string): Promise<string> {
    try {
      const page = await this.notion.pages.retrieve({ page_id: pageId });
      
      if ('properties' in page && page.properties.title && 'title' in page.properties.title) {
        const titleProperty = page.properties.title.title;
        if (Array.isArray(titleProperty) && titleProperty.length > 0) {
          return titleProperty.map(t => t.plain_text).join('');
        }
      }
      
      if ('properties' in page) {
        for (const prop of Object.values(page.properties)) {
          if (prop.type === 'title' && 'title' in prop && Array.isArray(prop.title) && prop.title.length > 0) {
            return prop.title.map(t => t.plain_text).join('');
          }
        }
      }
      
      return 'Untitled';
    } catch (error) {
      console.error(`Error getting page title for ${pageId}:`, error);
      return 'Untitled';
    }
  }

  private async getAllPages(pageId: string, currentPath: string[] = []): Promise<PageInfo[]> {
    const pages: PageInfo[] = [];
    
    try {
      const title = await this.getPageTitle(pageId);
      const pagePath = [...currentPath, this.sanitizeFileName(title)];
      
      pages.push({
        id: pageId,
        title,
        path: pagePath
      });
      
      const children = await this.notion.blocks.children.list({
        block_id: pageId,
        page_size: 100
      });
      
      for (const child of children.results) {
        if ('type' in child && child.type === 'child_page' && child.id) {
          const childPages = await this.getAllPages(child.id, pagePath);
          pages.push(...childPages);
        }
      }
    } catch (error) {
      console.error(`Error getting pages for ${pageId}:`, error);
    }
    
    return pages;
  }

  private async convertPageToMarkdown(pageId: string): Promise<string> {
    try {
      const mdBlocks = await this.n2m.pageToMarkdown(pageId);
      const mdString = this.n2m.toMarkdownString(mdBlocks);
      
      const frontmatter = `---
notion_id: ${pageId}
last_sync: ${new Date().toISOString()}
---

`;
      
      return frontmatter + mdString.parent;
    } catch (error) {
      console.error(`Error converting page ${pageId} to markdown:`, error);
      return '';
    }
  }

  private async savePage(pageInfo: PageInfo, content: string): Promise<void> {
    const filePath = path.join(this.obsidianPath, ...pageInfo.path) + '.md';
    const dirPath = path.dirname(filePath);
    
    await this.ensureDirectory(dirPath);
    
    try {
      await fs.writeFile(filePath, content, 'utf8');
      console.log(`Saved: ${filePath}`);
    } catch (error) {
      console.error(`Error saving file ${filePath}:`, error);
    }
  }

  public async sync(): Promise<void> {
    console.log('Starting Notidian sync...');
    console.log(`Root page ID: ${this.rootPageId}`);
    console.log(`Obsidian vault path: ${this.obsidianPath}`);
    
    try {
      await this.ensureDirectory(this.obsidianPath);
      
      console.log('Fetching page structure from Notion...');
      const pages = await this.getAllPages(this.rootPageId);
      console.log(`Found ${pages.length} pages to sync`);
      
      for (const pageInfo of pages) {
        console.log(`Processing: ${pageInfo.path.join('/')}`);
        const content = await this.convertPageToMarkdown(pageInfo.id);
        if (content) {
          await this.savePage(pageInfo, content);
        }
      }
      
      console.log('Sync completed successfully!');
    } catch (error) {
      console.error('Sync failed:', error);
      process.exit(1);
    }
  }
}

async function main() {
  try {
    const sync = new NotidianSync();
    await sync.sync();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}