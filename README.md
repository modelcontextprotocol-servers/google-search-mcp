# Google Search MCP

[Model Context Protocol](https://modelcontextprotocol.wiki) server for google search.
A Playwright-based Model Context Protocol (MCP) tool that bypasses search engine anti-bot mechanisms, performs Google searches, and extracts results, providing real-time search capabilities for AI assistants like Claude and Cursor.

<a href="https://glama.ai/mcp/servers/@modelcontextprotocol-servers/google-search-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@modelcontextprotocol-servers/google-search-mcp/badge" alt="Google Search MCP server" />
</a>

## Features

- **Anti-Bot Bypass**: Uses browser fingerprint spoofing and real user behavior simulation to avoid detection
- **Automatic CAPTCHA Handling**: Switches to headed mode when encountering CAPTCHAs, allowing users to complete verification
- **State Persistence**: Saves browser session state to reduce the need for repeated verification
- **Adaptability**: Uses multiple selector combinations to adapt to changes in Google search pages
- **MCP Integration**: Implements the Model Context Protocol for easy integration with AI assistants
- **Multi-language Support**: Supports search results in different languages and regions


## Using with Cursor

**Installation - Globally**

Run the MCP server using npx:

```bash
npx -y @mcp-server/google-search-mcp@latest
```

In your Cursor IDE

1. Go to `Cursor Settings` > `MCP`
2. Click `+ Add New MCP Server`
3. Fill in the form:
   - Name: `google-search` (or any name you prefer)
   - Type: `command`
   - Command: `npx -y @mcp-server/google-search-mcp@latest`


**Installation - Project-specific**

Add an `.cursor/mcp.json` file to your project:

```json
{
  "mcpServers": {
    "google-search": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp-server/google-search-mcp@latest"
      ]
    }
  }
}
```

## Development

```bash
yarn install
```

## Build the project

```bash
yarn build
```

## Usage

### Running as an MCP Server

```bash
yarn start
```

### Using with MCP Inspector

To debug the server, you can use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
# First build the project
yarn build

# Start the MCP Inspector and server
npx @modelcontextprotocol/inspector node dist/index.js
```

## Parameters

The search tool accepts the following parameters:

- `query` (required): Search query string
- `limit` (optional): Number of search results to return, default is 10
- `timeout` (optional): Search operation timeout in milliseconds, default is 60000
- `language` (optional): Language for search results, e.g., zh-CN, en-US, default is zh-CN
- `region` (optional): Region for search results, e.g., cn, com, co.jp, default is cn

## How It Works

1. The tool uses Playwright to control a Chromium browser to perform Google searches
2. It avoids bot detection through browser fingerprint spoofing and real user behavior simulation
3. When encountering CAPTCHA verification, it automatically switches to headed mode for user completion
4. It extracts search results and returns them in a structured format
5. It saves browser state for reuse in subsequent searches

## Advanced Configuration

### Browser State File

By default, the browser state is saved in the `.google-search-browser-state.json` file in the user's home directory. You can modify this path through parameters.

### Language and Region Settings

You can specify the language and region for search results through parameters:

```
// English (US) search results
"language": "en-US", "region": "com"

// Japanese search results
"language": "ja-JP", "region": "co.jp"

// Chinese (Simplified) search results
"language": "zh-CN", "region": "cn"
```

## Notes

- On first use, if you encounter CAPTCHA verification, the system will automatically switch to headed mode for you to complete the verification
- After verification, the system will save the state file, making subsequent searches smoother
- Overly frequent search requests may trigger Google's rate limiting mechanisms
- This tool is for learning and research purposes only, please comply with Google's terms of service

## License

MIT

## Disclaimer

This tool is for learning and research purposes only. When using this tool to access Google or other search engines, please comply with relevant terms of service and legal regulations. The author is not responsible for any issues resulting from the use of this tool.