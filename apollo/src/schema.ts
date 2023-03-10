import {
  makeSchema,
  mutationType,
  nonNull,
  objectType,
  queryType,
  stringArg,
  subscriptionType,
  intArg,
  arg,
  inputObjectType,
} from 'nexus'
import { Context } from './context'

const User = objectType({
  name: 'User',
  definition(t) {
    t.nonNull.string('id')
    t.string('name')
    t.nonNull.string('email')
    t.nonNull.list.nonNull.field('posts', {
      type: 'Post',
      resolve: (parent, _, context: Context) => {
        return context.prisma.user
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .posts()
      },
    })
  },
})

const Post = objectType({
  name: 'Post',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.string('title')
    t.string('content')
    t.nonNull.boolean('published')
    t.field('author', {
      type: 'User',
      resolve: (parent, _, context: Context) => {
        return context.prisma.post
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .author()
      },
    })
  },
})

const Product = objectType({
  name: 'Product',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.string('name')
    t.nonNull.string('image')
    t.nonNull.float('price')
    t.nonNull.string('description')
  },
})


export const Query = queryType({
  definition(t) {
    t.nonNull.list.nonNull.field('allUsers', {
      type: 'User',
      resolve: (_parent, _args, context: Context) => {
        return context.prisma.user.findMany()
      },
    })

    t.nonNull.list.nonNull.field('feed', {
      type: 'Post',
      args: {
        searchString: stringArg(),
        skip: intArg(),
        take: intArg(),
      },
      resolve: (_parent, args, context: Context) => {
        const or = args.searchString
          ? {
              OR: [
                { title: { contains: args.searchString } },
                { content: { contains: args.searchString } },
              ],
            }
          : {}

        return context.prisma.post.findMany({
          where: {
            published: true,
            ...or,
          },
          take: args.take || undefined,
          skip: args.skip || undefined,
        })
      },
    })

    t.nonNull.list.nonNull.field('products', {
      type: 'Product',
      args: {
        searchString: stringArg(),
        skip: intArg(),
        take: intArg(),
      },
      resolve: (_parent, args, context: Context) => {
        const or = args.searchString
          ? {
              OR: [
                { name: { contains: args.searchString } },
                { description: { contains: args.searchString } },
              ],
            }
          : {}

        return context.prisma.product.findMany({
          where: {
            ...or,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: args.take || undefined,
          skip: args.skip || undefined,
        })
      },
    })
  },
})

export const Mutation = mutationType({
  definition(t) {
    t.field('createProduct', {
      type: 'Product',
      args: {
        data: nonNull(
          arg({
            type: 'ProductCreateInput',
          }),
        ),
      },
      resolve: async (_, args, context: Context) => {
        const newProduct = await context.prisma.product.create({
          data: {
            name: args.data.name,
            price: args.data.price,
            image: args.data.image,
            description: args.data.description,
          },
        })

        // publish the subscription here
        context.pubsub.publish('newProduct', newProduct)
        return newProduct
      },
    })


    t.field('createDraft', {
      type: 'Post',
      args: {
        data: nonNull(
          arg({
            type: 'PostCreateInput',
          }),
        ),
        authorEmail: stringArg(),
      },
      resolve: async (_, args, context: Context) => {
        const newPost = await context.prisma.post.create({
          data: {
            title: args.data.title,
            content: args.data.content,
            author: {
              connect: { email: args.authorEmail },
            },
          },
        })

        // publish the subscription here
        context.pubsub.publish('newPost', newPost)
        return newPost
      },
    })

    t.field('togglePublishPost', {
      type: 'Post',
      args: {
        id: nonNull(intArg()),
      },
      resolve: async (_, args, context: Context) => {
        try {
          const post = await context.prisma.post.findUnique({
            where: { id: args.id || undefined },
          })

          if (!post.published) {
            // publish the subscription here
            context.pubsub.publish('postPublished', post)
          }

          return context.prisma.post.update({
            where: { id: args.id || undefined },
            data: { published: !post?.published },
          })
        } catch (e) {
          throw new Error(
            `Post with ID ${args.id} does not exist in the database.`,
          )
        }
      },
    })
  },
})

export const Subscription = subscriptionType({
  definition(t) {
    t.field('newProduct', {
      type: 'Product',
      subscribe(_root, _args, ctx) {
        return ctx.pubsub.asyncIterator('newProduct')
      },
      resolve(payload) {
        return payload
      },
    })

    t.field('newPost', {
      type: 'Post',
      subscribe(_root, _args, ctx) {
        return ctx.pubsub.asyncIterator('newPost')
      },
      resolve(payload) {
        return payload
      },
    })

    t.field('postPublished', {
      type: 'Post',
      subscribe(_root, _args, ctx) {
        return ctx.pubsub.asyncIterator('postPublished')
      },
      resolve(payload) {
        return payload
      },
    })
  },
})

const PostCreateInput = inputObjectType({
  name: 'PostCreateInput',
  definition(t) {
    t.nonNull.string('title')
    t.string('content')
  },
})

const ProductCreateInput = inputObjectType({
  name: 'ProductCreateInput',
  definition(t) {
    t.nonNull.string('name')
    t.float('price')
    t.string('image')
    t.string('description')
  },
})

export const schema = makeSchema({
  types: [
    User,
    Post,
    Product,
    Query,
    Mutation,
    Subscription,
    PostCreateInput,
    ProductCreateInput,
  ],
  outputs: {
    schema: __dirname + '/../schema.graphql',
    typegen: __dirname + '/generated/nexus.ts',
  },
  contextType: {
    module: require.resolve('./context'),
    export: 'Context',
  },
  sourceTypes: {
    modules: [
      {
        module: '@prisma/client',
        alias: 'prisma',
      },
    ],
  },
})
