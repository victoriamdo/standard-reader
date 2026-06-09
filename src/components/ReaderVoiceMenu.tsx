import type { ReaderVoicePreference } from "#/lib/reader-voice";

import * as stylex from "@stylexjs/stylex";
import { MenuItem, SubMenu } from "#/design-system/menu";
import { uiColor } from "#/design-system/theme/color.stylex";
import { AMERICAN_ENGLISH_VOICES } from "#/lib/page-reader/voice-catalog";
import {
  isReaderVoicePreference,
  readerVoicePreferenceLabel,
} from "#/lib/reader-voice";
import { useReaderVoice } from "#/lib/use-reader-voice";
import { Sparkles } from "lucide-react";

const styles = stylex.create({
  currentPreference: {
    color: uiColor.text1,
  },
  grade: {
    color: uiColor.text1,
  },
});

function ReaderVoiceMenuItems({
  onSelect,
}: {
  onSelect: (next: ReaderVoicePreference) => void;
}) {
  return (
    <>
      <MenuItem
        id="auto"
        prefix={<Sparkles size={16} />}
        onAction={() => onSelect("auto")}
      >
        Auto
      </MenuItem>
      {AMERICAN_ENGLISH_VOICES.map((voice) => (
        <MenuItem
          key={voice.id}
          id={voice.id}
          suffix={
            <span {...stylex.props(styles.grade)}>{voice.overallGrade}</span>
          }
          onAction={() => {
            if (isReaderVoicePreference(voice.id)) onSelect(voice.id);
          }}
        >
          {voice.name}
        </MenuItem>
      ))}
    </>
  );
}

export function ReaderVoiceSubMenu() {
  const { preference, setPreference } = useReaderVoice();
  const currentLabel = readerVoicePreferenceLabel(preference);

  return (
    <SubMenu
      trigger={
        <MenuItem
          suffix={
            <span {...stylex.props(styles.currentPreference)}>
              {currentLabel}
            </span>
          }
        >
          Reader voice
        </MenuItem>
      }
      selectionMode="single"
      selectedKeys={new Set([preference])}
      disallowEmptySelection
      onSelectionChange={(keys) => {
        const key = keys === "all" ? undefined : [...keys][0];
        if (isReaderVoicePreference(key)) setPreference(key);
      }}
    >
      <ReaderVoiceMenuItems onSelect={setPreference} />
    </SubMenu>
  );
}
