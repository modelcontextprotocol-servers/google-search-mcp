#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { fileURLToPath } from "url"
import { googleSearch } from "./search.js"
import { CommandOptions } from "./types.js"

// Get the directory path of the current file
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const STATE_FILE_PATH = path.join(os.homedir(), ".google-search-browser-state.json")
const DEFAULT_TIMEOUT = 60000 // 60 seconds
const DEFAULT_LIMIT = 10 // Default returns 10 results
const DEFAULT_LANGUAGE = "zh-CN" // Default language
const DEFAULT_REGION = "cn" // Default region

// Create MCP server instance
const server = new McpServer({
  name: "Google Search MCP",
  version: "1.0.0",
  description: "Google Search MCP server based on Playwright",
})

// Add Google Search tool
server.tool(
  "search",
  { 
    query: z.string().describe("Search query string"),
    limit: z.number().optional().describe("Number of search results returned, default is 10"),
    timeout: z.number().optional().describe("Timeout for search operation (milliseconds), default is 60000"),
    language: z.string().optional().describe("Language of search results, e.g., zh-CN, en-US, default is zh-CN"),
    region: z.string().optional().describe("Region of search results, e.g., cn, com, co.jp, default is  cn")
  },
  async ({ 
    query, 
    limit = DEFAULT_LIMIT, 
    timeout = DEFAULT_TIMEOUT,
    language = DEFAULT_LANGUAGE,
    region = DEFAULT_REGION
  }: { 
    query: string; 
    limit?: number; 
    timeout?: number;
    language?: string;
    region?: string;
  }) => {
    try {
      // Build search options
      const options: CommandOptions = {
        limit,
        timeout,
        stateFile: STATE_FILE_PATH,
        locale: language,
        region
      }

      // Execute search
      const results = await googleSearch(query, options)
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify(results, null, 2)
        }]
      }
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error occurred during Google search: ${error.message}` }],
        isError: true
      }
    }
  }
)

// Start server
async function main() {
  try {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error("Google Search MCP server has started")
  } catch (error: any) {
    console.error("Error occurred while starting Google Search MCP server:", error)
    process.exit(1)
  }
}

main()
