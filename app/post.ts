import parseFrontMatter from 'front-matter';
import invariant from 'tiny-invariant';
import { marked } from 'marked';
import { Storage } from '@google-cloud/storage';

export type Post = {
  slug: string;
  title: string;
};

export type PostMarkdownAttributes = {
  title: string;
};

type NewPost = {
  title: string;
  slug: string;
  markdown: string;
};

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL,
    private_key: process.env.GCP_PRIVATE_KEY!.replace(/\\n/g, '\n')
  }
});

const bucketName = 'wubbwubb-remix-netlify-demo';
const postsPath = 'posts';

function isValidPostAttributes(attributes: any): attributes is PostMarkdownAttributes {
  return attributes?.title;
}

function getFileName(slug: string) {
  return `${postsPath}/${slug}.md`;
}

export async function getPosts() {
  // Lists files in the bucket
  const [files] = await storage.bucket(bucketName).getFiles({ prefix: `${postsPath}/`, delimiter: '/' });

  return Promise.all(
    files
      .map(file => {
        let fileName = file.name;
        const lastSlash = fileName.lastIndexOf('/');

        if (fileName.endsWith('/')) {
          return '';
        }

        if (lastSlash >= 0) {
          fileName = fileName.substring(lastSlash + 1);
        }

        if (fileName.length <= 3) {
          return '';
        }

        return fileName.substring(0, fileName.length - 3);
      })
      .filter(slug => slug.length > 0)
      .map(async slug => {
        return getPost(slug);
      })
  );
}

export async function getPost(slug: string) {
  // Downloads the file into a buffer in memory.
  const fileName = getFileName(slug);
  const contents = await storage.bucket(bucketName).file(fileName).download();

  const { attributes, body } = parseFrontMatter(contents.toString());
  invariant(isValidPostAttributes(attributes), `Post ${fileName} is missing attributes`);
  const html = marked(body);
  return { slug, html, title: attributes.title };
}

export async function createPost(post: NewPost) {
  const md = `---\ntitle: ${post.title}\n---\n\n${post.markdown}`;

  await storage.bucket(bucketName).file(getFileName(post.slug)).save(md);

  return getPost(post.slug);
}
