const fs = require(`fs`)
const path = require(`path`)
const mkdirp = require(`mkdirp`)
const kebab = require(`lodash.kebabcase`)
const Debug = require(`debug`)

const debug = Debug(`gatsby-theme-digital-garden`)

const Post = require.resolve('./src/templates/post')
const Posts = require.resolve('./src/templates/posts')
const Wiki = require.resolve('./src/templates/wiki')

exports.createPages = async ({ graphql, actions }, pluginOptions) => {
  const { createPage, createRedirect } = actions

  const {
    postsPath = `/posts`,
    postsPerPage = 9999,
    wikiPath = '/wiki'
  } = pluginOptions

  const result = await graphql(`
    {
      mdxPages: allMdx(
        sort: { fields: [frontmatter___date], order: DESC }
        filter: { frontmatter: { draft: { ne: true }, archived: { ne: true } } }
      ) {
        edges {
          node {
            id
            excerpt
            parent {
              ... on File {
                name
                sourceInstanceName
              }
            }
            frontmatter {
              path
              title
              redirects
              date(formatString: "MMMM DD, YYYY")
            }
            code {
              scope
            }
          }
        }
      }
    }
  `)

  if (result.errors) {
    console.log(result.errors)
    throw new Error(`Could not query articles`, result.errors)
  }

  const { mdxPages } = result.data

  // Create pages and redirects
  mdxPages.edges.forEach(({ node }) => {
    const fallbackPath = `/${node.parent.sourceInstanceName}/${
      node.parent.name
    }`
    const path = node.frontmatter.path || fallbackPath

    if (node.frontmatter.redirects) {
      node.frontmatter.redirects.forEach(fromPath => {
        createRedirect({
          fromPath,
          toPath: path,
          redirectInBrowser: true,
          isPermanent: true,
        })
      })
    }

    if (node.parent.sourceInstanceName === 'wiki') {
      return createPage({
        path,
        context: node,
        component: Wiki,
      })
    }

    createPage({
      path,
      context: node,
      component: Post,
    })
  })

  // Create post list pages
  const posts = mdxPages.edges
  const numPages = Math.ceil(posts.length / postsPerPage)
  Array.from({ length: numPages }).forEach((_, i) => {
    const limit = postsPerPage
    const skip = i * postsPerPage
    const currentPage = i + 1

    const isFirst = currentPage === 1
    const isLast = currentPage === numPages

    const nextPage = isLast ? null : `${postsPath}/${currentPage + 1}`
    const prevPage = isFirst
      ? null
      : `${postsPath}/${currentPage - 1 === 1 ? `` : currentPage - 1}`

    createPage({
      path: isFirst ? postsPath : `${postsPath}/${currentPage}`,
      component: Posts,
      context: {
        limit,
        skip,
        currentPage,
        isFirst,
        isLast,
        nextPage,
        prevPage,
      },
    })
  })
}

exports.onPreBootstrap = ({ store }) => {
  const { program } = store.getState()

  const dirs = [
    path.join(program.directory, `posts`),
    path.join(program.directory, `pages`),
    path.join(program.directory, `wiki`),
  ]

  dirs.forEach(dir => {
    debug(`Initializing ${dir} directory`)
    if (!fs.existsSync(dir)) {
      mkdirp.sync(dir)
    }
  })
}

exports.onCreateWebpackConfig = ({ loaders, actions }) => {
  actions.setWebpackConfig({
    module: {
      rules: [
        {
          test: /\.js$/,
          include: path.dirname(require.resolve(`gatsby-theme-digital-garden`)),
          use: [loaders.js()],
        },
      ],
    },
  })
}