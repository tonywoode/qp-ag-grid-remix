import { cssBundleHref } from "@remix-run/css-bundle"
import type { LinksFunction, MetaFunction } from "@remix-run/node"
import { Link, Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react'
import styles from '~/styles/styles.css'
import tailwindStyles from '~/styles/tailwind.css'

export const meta: MetaFunction = () => [{ title: "New Remix App" }]

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
  { rel: 'stylesheet', href: styles },
  { rel: 'stylesheet', href: tailwindStyles }
]

export default function App() {
	return (
    <html lang="en">
      <head>
        <meta charSet="utf8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Link to="layout">layout</Link>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        {process.env.NODE_ENV === 'development' && <LiveReload />}
      </body>
    </html>
  )
}
