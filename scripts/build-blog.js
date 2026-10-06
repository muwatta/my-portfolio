import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as parseYaml } from "js-yaml";

const rootDir = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const postsDir = join(rootDir, "public", "blog", "posts");
const markdownDir = join(rootDir, "content", "blog");
const outFile = join(rootDir, "public", "blog.json");

const legacyPosts = existsSync(postsDir)
  ? readdirSync(postsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(postsDir, f), "utf8")))
  : [];

function parseMarkdownPost(source, fileName) {
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!frontMatter) {
    return { data: {}, content: source };
  }

  const data = parseYaml(frontMatter[1], { maxAliasCount: 20 }) ?? {};
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`Expected YAML front matter to be an object in ${fileName}`);
  }

  return { data, content: source.slice(frontMatter[0].length) };
}

const markdownPosts = existsSync(markdownDir)
  ? readdirSync(markdownDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        const source = readFileSync(join(markdownDir, f), "utf8");
        const { data, content } = parseMarkdownPost(source, f);
        return {
          ...data,
          medium_link: data.medium_link || data.mediumLink,
          body: content.trim(),
        };
      })
  : [];

const posts = [...legacyPosts, ...markdownPosts]
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .map((post, i) => ({ ...post, id: post.id || i + 1 }));

writeFileSync(outFile, JSON.stringify(posts, null, 2) + "\n", "utf8");
console.log(`✔ Generated public/blog.json with ${posts.length} posts`);
