"use client";

import { ReadingCustomFontLoader } from "#/components/reading-custom-font-loader";
import { readingCustomFontFamily } from "#/lib/reading-typography";
import { useReadingTypography } from "#/lib/use-reading-typography";

import { readingBodyStyleProps } from "../../body-styles";

export function ArticleBody({
  hasHero,
  children,
}: {
  hasHero: boolean;
  children: React.ReactNode;
}) {
  const { preference } = useReadingTypography();

  return (
    <>
      <ReadingCustomFontLoader family={readingCustomFontFamily(preference)} />
      <div {...readingBodyStyleProps(preference, hasHero)}>{children}</div>
    </>
  );
}
