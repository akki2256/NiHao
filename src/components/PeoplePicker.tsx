import React from 'react';
import { Text, View } from 'react-native';
import { useData } from '../context/DataContext';
import { useColors } from '../theme/ThemeContext';
import { Chip } from './ui';

/** Toggle which teammates share a project or an expense. At least one is required. */
export function PeoplePicker({
  selected,
  onChange,
  label = 'People',
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const colors = useColors();
  const { data } = useData();
  const people = data.contributors.filter((c) => c.active_code === 'active');

  return (
    <View style={{ marginBottom: 8 }}>
      <Text
        style={{
          color: colors.textMuted,
          marginBottom: 8,
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {people.map((person) => {
          const on = selected.includes(person.contributor_id);
          return (
            <Chip
              key={person.contributor_id}
              icon="person"
              label={person.display_name}
              active={on}
              onPress={() =>
                onChange(
                  on
                    ? selected.filter((id) => id !== person.contributor_id)
                    : [...selected, person.contributor_id],
                )
              }
            />
          );
        })}
      </View>
    </View>
  );
}
