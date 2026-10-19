import { AppIcon } from '../components/Icon';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import {
  Card,
  GhostButton,
  IconBubble,
  Loader,
  Screen,
  ScreenHeader,
  StatusBadge,
  useListPadding,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { RootStackParamList } from '../navigation/types';
import { sectionColors } from '../theme/colors';
import type { Palette } from '../theme/colors';
import { useColors } from '../theme/ThemeContext';

export function ContributorsScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user } = useAuth();
  const { data, loading, syncStatus, syncMessage } = useData();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const listPadding = useListPadding(true);

  const people = data.contributors.filter((c) => c.active_code === 'active');

  if (loading) return <Loader />;

  return (
    <Screen tab syncStatus={syncStatus} syncMessage={syncMessage}>
      <FlatList
        data={people}
        keyExtractor={(item) => item.contributor_id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={listPadding}
        ListHeaderComponent={
          <View>
            <ScreenHeader
              icon="people"
              color={sectionColors.team}
              title="Team"
              subtitle="Everyone working together"
            />
            <GhostButton
              icon="person-circle"
              color={sectionColors.team}
              label="Edit my profile"
              onPress={() => navigation.navigate('ContributorEdit')}
            />
          </View>
        }
        renderItem={({ item }) => {
          const isMe = item.contributor_id === user?.contributor_id;
          return (
            <Card accent={isMe ? sectionColors.team : undefined}>
              <View style={styles.row}>
                <IconBubble name="person" color={sectionColors.team} size={44} />
                <View style={styles.text}>
                  <Text numberOfLines={1} style={styles.name}>
                    {item.display_name}
                  </Text>
                  <Text style={styles.handle}>@{item.username}</Text>
                </View>
                {isMe ? <StatusBadge label="You" color={sectionColors.team} icon="star" /> : null}
              </View>
              <View style={styles.contact}>
                <AppIcon name="mail-outline" size={16} color={colors.textMuted} />
                <Text numberOfLines={1} style={styles.contactText}>
                  {item.email || 'No email'}
                </Text>
              </View>
              <View style={styles.contact}>
                <AppIcon name="call-outline" size={16} color={colors.textMuted} />
                <Text numberOfLines={1} style={styles.contactText}>
                  {item.phone || 'No phone'}
                </Text>
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
  handle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  contactText: { color: colors.textMuted, fontSize: 14, flexShrink: 1 },
});
}
