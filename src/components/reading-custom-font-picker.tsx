"use client";

import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { GoogleFontMenuLabel } from "#/components/google-font-menu-label";
import { googleFontsApi } from "#/integrations/tanstack-query/api-google-fonts.functions";
import { useEffect, useMemo, useState } from "react";

import { ComboBox, ComboBoxItem } from "../design-system/combobox";
import { spacing } from "../design-system/theme/spacing.stylex";
import { SizeContext } from "#/design-system/context.ts";

const styles = stylex.create({
  picker: {
    minWidth: {
      "@media (max-width: 47.5rem)": "100%",
      default: spacing["56"],
    },
    width: {
      "@media (max-width: 47.5rem)": "100%",
      default: spacing["56"],
    },
  },
});

type GoogleFontItem = {
  id: string;
  name: string;
};

export function ReadingCustomFontPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (family: string) => void;
}) {
  const [search, setSearch] = useState(value);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  const { data, isPending, isError } = useQuery({
    ...googleFontsApi.getGoogleFontFamiliesQueryOptions,
  });

  const items = useMemo(() => {
    const families = data?.families ?? [];
    const query = search.trim().toLowerCase();
    const filtered = query
      ? families.filter((family) => family.toLowerCase().includes(query))
      : families;

    const mapped: Array<GoogleFontItem> = filtered.map((family) => ({
      id: family,
      name: family,
    }));

    if (
      value &&
      !mapped.some((item) => item.id === value) &&
      isValidSelection(value, families)
    ) {
      mapped.unshift({ id: value, name: value });
    }

    return mapped;
  }, [data?.families, search, value]);

  return (
    <ComboBox
      aria-label="Google Font"
      placeholder={isPending ? "Loading fonts…" : "Search Google Fonts"}
      items={items}
      inputValue={search}
      onInputChange={setSearch}
      selectedKey={value}
      onSelectionChange={(key) => {
        if (key == null) return;
        const family = String(key);
        setSearch(family);
        onChange(family);
      }}
      isDisabled={isPending || isError}
      allowsEmptyCollection
      isVirtualized
      style={styles.picker}
    >
      {(item: GoogleFontItem) => (
        <SizeContext value="lg">
          <ComboBoxItem id={item.id} textValue={item.name}>
            <GoogleFontMenuLabel name={item.name} />
          </ComboBoxItem>
        </SizeContext>
      )}
    </ComboBox>
  );
}

function isValidSelection(
  value: string,
  families: ReadonlyArray<string>,
): boolean {
  return families.includes(value);
}
