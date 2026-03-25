export type PolicySection = {
  heading: string;
  content: (string | string[])[]; // string = paragraph, string[] = bullet list
};

export type PolicyPageProps = {
  title: string;
  effectiveDate: string;
  description: string;
  sections: PolicySection[];
};

export function PolicyPage({
  title,
  effectiveDate,
  description,
  sections,
}: PolicyPageProps) {
  return (
    <div className="bg-white px-6 py-32 lg:px-8">
      <div className="mx-auto max-w-3xl text-base/7 text-gray-700">
        <p className="text-base/7 font-semibold text-indigo-600">
          {effectiveDate}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-6 text-xl/8 text-gray-700">{description}</p>

        <div className="prose prose-gray prose-headings:tracking-tight mt-10 max-w-2xl">
          {sections.map((section) => (
            <div key={section.heading} className="mt-16 first:mt-0">
              <h2>{section.heading}</h2>
              {section.content.map((block) =>
                Array.isArray(block) ? (
                  <ul key={block[0]}>
                    {block.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={block.slice(0, 60)}>{block}</p>
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
