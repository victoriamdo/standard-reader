"use client";

import * as stylex from "@stylexjs/stylex";
import { use, useState } from "react";
import { flushSync } from "react-dom";

import { AspectRatio, AspectRatioImage } from "#/design-system/aspect-ratio";
import { Lightbox } from "#/design-system/lightbox";
import {
  LIGHTBOX_IMAGE_TRANSITION_NAME,
  startLightboxViewTransition,
} from "#/design-system/lightbox/transition";
import { spacing } from "#/design-system/theme/spacing.stylex";
import { normalizeImageAlt } from "#/lib/document/structured-content/image";
import { MagazineColorContext } from "#/magazine/context";

import { articleBodyStyles } from "../../body-styles";

const styles = stylex.create({
  imageButton: {
    padding: spacing["0"],
    borderWidth: 0,
    backgroundColor: "transparent",
    width: "100%",
  },
  imageButtonInteractive: {
    cursor: "zoom-in",
  },
});

export function ImageFigureView({
  src,
  alt,
  aspectRatio = 16 / 9,
  fullBleed = false,
  lightboxEnabled = false,
}: {
  src: string;
  alt?: string;
  aspectRatio?: number;
  fullBleed?: boolean;
  lightboxEnabled?: boolean;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [transitionActive, setTransitionActive] = useState(false);
  const magazine = use(MagazineColorContext);
  const altText = normalizeImageAlt(alt);
  const canOpenLightbox = lightboxEnabled && !magazine;
  const transitionName = LIGHTBOX_IMAGE_TRANSITION_NAME;

  return (
    <figure
      {...stylex.props(
        articleBodyStyles.imageFigure,
        fullBleed && !magazine ? articleBodyStyles.imageFullBleed : undefined,
      )}
    >
      {magazine ? (
        <img
          alt={altText}
          data-mag-block-photo=""
          loading="lazy"
          referrerPolicy="no-referrer"
          src={src}
        />
      ) : canOpenLightbox ? (
        <button
          aria-label={altText || "Open image"}
          type="button"
          onClick={() => {
            flushSync(() => setTransitionActive(true));
            startLightboxViewTransition(() => setLightboxOpen(true));
          }}
          style={
            transitionActive && !lightboxOpen
              ? { viewTransitionName: transitionName }
              : undefined
          }
          {...stylex.props(styles.imageButton, styles.imageButtonInteractive)}
        >
          <AspectRatio aspectRatio={aspectRatio} rounded={!fullBleed}>
            <AspectRatioImage
              alt={altText}
              referrerPolicy="no-referrer"
              src={src}
            />
          </AspectRatio>
        </button>
      ) : (
        <AspectRatio aspectRatio={aspectRatio} rounded={!fullBleed}>
          <AspectRatioImage
            alt={altText}
            referrerPolicy="no-referrer"
            src={src}
          />
        </AspectRatio>
      )}
      {altText ? (
        <figcaption
          aria-hidden="true"
          {...stylex.props(articleBodyStyles.imageCaption)}
        >
          {altText}
        </figcaption>
      ) : null}
      {canOpenLightbox ? (
        <Lightbox
          alt="Image"
          images={[
            {
              src,
              alt: altText,
              transitionName: transitionActive ? transitionName : undefined,
            },
          ]}
          isOpen={lightboxOpen}
          onOpenChange={(open) => {
            setLightboxOpen(open);
            if (!open) setTransitionActive(false);
          }}
        />
      ) : null}
    </figure>
  );
}
