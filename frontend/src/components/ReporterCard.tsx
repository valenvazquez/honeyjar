import type { ReporterMatch } from "../types";

interface Props {
  match: ReporterMatch;
}

export default function ReporterCard({ match }: Props) {
  const { reporter, score, explanation, keyphrases, matchedArticles } = match;
  const scorePercent = Math.round(score * 100);

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">{reporter.name}</h3>
          <p className="text-sm text-gray-600">
            {reporter.title} &middot; {reporter.outlet}
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          {scorePercent}%
        </span>
      </div>

      <p className="text-sm text-gray-700 mb-3">{explanation}</p>

      {keyphrases.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {keyphrases.map((kp, index) => (
            <span
              key={kp + index}
              className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {kp}
            </span>
          ))}
        </div>
      )}

      {matchedArticles.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Relevant Articles
          </p>
          <ul className="space-y-1">
            {matchedArticles.slice(0, 3).map((article, index) => (
              <li key={article.url + index} className="text-sm">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-600 hover:underline"
                >
                  {article.title}
                </a>
                <span className="text-gray-400 ml-2 text-xs">
                  {new Date(article.publishDate).toLocaleDateString()} &middot;{" "}
                  {Math.round(article.similarity * 100)}% match
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm text-gray-500 border-t border-gray-100 pt-3">
        {reporter.email && (
          <a href={`mailto:${reporter.email}`} className="hover:text-amber-600">
            {reporter.email}
            <span className="ml-1 text-xs text-gray-400">
              ({reporter.emailConfidence})
            </span>
          </a>
        )}
        {reporter.linkedinUrl && (
          <a
            href={reporter.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-amber-600"
          >
            LinkedIn
          </a>
        )}
        {reporter.twitterHandle && (
          <a
            href={`https://twitter.com/${reporter.twitterHandle.replace(/^@/, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-amber-600"
          >
            {reporter.twitterHandle.startsWith("@")
              ? reporter.twitterHandle
              : `@${reporter.twitterHandle}`}
          </a>
        )}
        {reporter.articleCount > 0 && (
          <span className="text-xs text-gray-400">
            {reporter.articleCount} articles
            {reporter.lastArticleDate &&
              ` · last ${new Date(reporter.lastArticleDate).toLocaleDateString()}`}
          </span>
        )}
      </div>
    </div>
  );
}
