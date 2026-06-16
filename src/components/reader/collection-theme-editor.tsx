"use client";

import type { CollectionsTheme } from "#/integrations/tanstack-query/api-collections.functions";

import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { collectionsApi } from "#/integrations/tanstack-query/api-collections.functions";
import { contrastRatio } from "#/lib/collections/color";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { Button } from "../../design-system/button";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "../../design-system/dialog";
import { Flex } from "../../design-system/flex";
import { TextField } from "../../design-system/text-field";
import { uiColor } from "../../design-system/theme/color.stylex";
import { radius } from "../../design-system/theme/radius.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
} from "../../design-system/theme/typography.stylex";

const DEFAULTS = {
  background: "#fbfaf7",
  foreground: "#1d1a17",
  accent: "#c0502f",
  accentForeground: "#ffffff",
};

const styles = stylex.create({
  headerTitle: {
    fontFamily: fontFamily.serif,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  row: { alignItems: "center", display: "flex", gap: "0.75rem" },
  rowLabel: {
    color: uiColor.text2,
    flexGrow: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
  },
  swatch: {
    backgroundColor: "transparent",
    borderColor: uiColor.border1,
    borderRadius: radius.sm,
    borderStyle: "solid",
    borderWidth: 1,
    cursor: "pointer",
    height: "2rem",
    padding: 0,
    width: "3rem",
  },
  hex: {
    color: uiColor.text1,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    width: "5rem",
  },
  warn: {
    alignItems: "center",
    color: "#b4690e",
    display: "flex",
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    gap: "0.4rem",
  },
});

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div {...stylex.props(styles.row)}>
      <span {...stylex.props(styles.rowLabel)}>{label}</span>
      <span {...stylex.props(styles.hex)}>{value}</span>
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...stylex.props(styles.swatch)}
      />
    </div>
  );
}

function ContrastWarning({
  ratio,
  min,
  message,
}: {
  ratio: number;
  min: number;
  message: string;
}) {
  if (ratio >= min) return null;
  return (
    <span {...stylex.props(styles.warn)}>
      <AlertTriangle size={13} aria-hidden /> {message} ({ratio.toFixed(1)}:1)
    </span>
  );
}

function ThemeForm({
  theme,
  close,
}: {
  theme: CollectionsTheme;
  close: () => void;
}) {
  const queryClient = useQueryClient();
  const [background, setBackground] = useState(
    theme.background ?? DEFAULTS.background,
  );
  const [foreground, setForeground] = useState(
    theme.foreground ?? DEFAULTS.foreground,
  );
  const [accent, setAccent] = useState(theme.accent ?? DEFAULTS.accent);
  const [accentForeground, setAccentForeground] = useState(
    theme.accentForeground ?? DEFAULTS.accentForeground,
  );
  const [fontTitle, setFontTitle] = useState(theme.fontTitle ?? "");
  const [fontBody, setFontBody] = useState(theme.fontBody ?? "");

  const saveMutation = useMutation(
    collectionsApi.putCollectionsThemeMutationOptions(),
  );

  const save = () => {
    if (saveMutation.isPending) return;
    saveMutation.mutate(
      {
        colors: { background, foreground, accent, accentForeground },
        fonts: {
          title: fontTitle.trim() || undefined,
          body: fontBody.trim() || undefined,
        },
      },
      {
        onSuccess: close,
        onSettled: () =>
          queryClient.invalidateQueries({
            queryKey: ["reader", "collectionsPublication"],
          }),
      },
    );
  };

  return (
    <>
      <DialogBody>
        <Flex direction="column" gap="lg">
          <ColorRow label="Background" value={background} onChange={setBackground} />
          <ColorRow label="Text" value={foreground} onChange={setForeground} />
          <ContrastWarning
            ratio={contrastRatio(foreground, background)}
            min={4.5}
            message="Body text contrast is low"
          />
          <ColorRow label="Accent" value={accent} onChange={setAccent} />
          <ContrastWarning
            ratio={contrastRatio(accent, background)}
            min={3}
            message="Accent is hard to see on the background"
          />
          <ColorRow
            label="Accent text"
            value={accentForeground}
            onChange={setAccentForeground}
          />
          <ContrastWarning
            ratio={contrastRatio(accentForeground, accent)}
            min={4.5}
            message="Text on the accent is hard to read"
          />

          <TextField
            label="Title font (Google Font name)"
            placeholder="e.g. Playfair Display"
            value={fontTitle}
            onChange={setFontTitle}
          />
          <TextField
            label="Body font (Google Font name)"
            placeholder="e.g. Source Serif 4"
            value={fontBody}
            onChange={setFontBody}
          />
        </Flex>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onPress={close}>
          Cancel
        </Button>
        <Button
          variant="primary"
          isDisabled={saveMutation.isPending}
          onPress={save}
        >
          Save theme
        </Button>
      </DialogFooter>
    </>
  );
}

/** Edit the collections publication's shared theme (colors + Google fonts). */
export function CollectionThemeEditor({
  isOpen,
  onOpenChange,
  theme,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  theme: CollectionsTheme;
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="sm"
      fitContent
      trigger={<span hidden aria-hidden />}
    >
      <DialogHeader>
        <span {...stylex.props(styles.headerTitle)}>Theme &amp; fonts</span>
      </DialogHeader>
      <ThemeForm
        key={isOpen ? "open" : "closed"}
        theme={theme}
        close={() => onOpenChange(false)}
      />
    </Dialog>
  );
}
