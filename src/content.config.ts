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

export const collections = { blog };
