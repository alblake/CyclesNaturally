import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useColors } from '@/hooks/useColors';

interface InsightCardProps {
  title: string;
  value: string;
  subtitle?: string;
  accent?: boolean;
}

export function InsightCard({ title, value, subtitle, accent }: InsightCardProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: accent ? colors.primary : colors.card,
          borderColor: accent ? 'transparent' : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.title,
          { color: accent ? 'rgba(255,255,255,0.8)' : colors.mutedForeground },
        ]}
      >
        {title}
      </Text>
      <Text style={[styles.value, { color: accent ? '#FFFFFF' : colors.foreground }]}>
        {value}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            { color: accent ? 'rgba(255,255,255,0.7)' : colors.mutedForeground },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    gap: 4,
  },
  title: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
});
