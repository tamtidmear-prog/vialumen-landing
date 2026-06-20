import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    titleTH: z.string(),
    date: z.string(),
    workshop: z.string().optional(),
    tags: z.array(z.string()),
    description: z.string(),
    descriptionTH: z.string(),
  }),
});

const books = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/books' }),
  schema: z.object({
    title: z.string(),
    titleTH: z.string(),
    chapter: z.number(),
    book: z.string(),
  }),
});

export const collections = { blog, books };
