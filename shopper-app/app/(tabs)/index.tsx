import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Keyboard,
  useColorScheme,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore, useCartTotal, useCartItemCount } from '@/store/cart-store';
import { fetchProductByBarcode, ApiError } from '@/services/api';

export default function ScanScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);

  const [barcode, setBarcode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const addItem = useCartStore((s) => s.addItem);
  const itemCount = useCartItemCount();
  const total = useCartTotal();

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const triggerPulse = useCallback(() => {
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.08,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pulseAnim]);

  const handleScan = async () => {
    const trimmed = barcode.trim();
    if (!trimmed) {
      Alert.alert('Empty Barcode', 'Please enter a barcode number.');
      return;
    }

    setIsLoading(true);
    Keyboard.dismiss();

    try {
      const product = await fetchProductByBarcode(trimmed);
      addItem(product);
      setLastAdded(product.name);
      triggerPulse();
      setBarcode('');

      // Clear success message after 3 seconds
      setTimeout(() => setLastAdded(null), 3000);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        Alert.alert(
          'Product Not Found',
          'Product not found in database'
        );
      } else if (error instanceof ApiError && error.statusCode === 0) {
        Alert.alert(
          'Connection Error',
          'Could not reach the server. Make sure the backend is running and you are on the same network.'
        );
      } else {
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logoText}>⚡</Text>
          <Text style={styles.title}>Smart Checkout</Text>
          <Text style={styles.subtitle}>
            Scan or enter a barcode to add items
          </Text>
        </View>

        {/* Cart Summary Pill */}
        <Animated.View
          style={[styles.cartPill, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.cartPillLeft}>
            <Text style={styles.cartPillIcon}>🛒</Text>
            <Text style={styles.cartPillCount}>
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </Text>
          </View>
          <Text style={styles.cartPillTotal}>${total.toFixed(2)}</Text>
        </Animated.View>

        {/* Success Toast */}
        {lastAdded && (
          <View style={styles.successToast}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>Added: {lastAdded}</Text>
          </View>
        )}

        {/* Barcode Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>BARCODE NUMBER</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="e.g. 8901030865732"
              placeholderTextColor={isDark ? '#444' : '#bbb'}
              value={barcode}
              onChangeText={setBarcode}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={handleScan}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.scanButton, isLoading && styles.scanButtonDisabled]}
              onPress={handleScan}
              disabled={isLoading}
              activeOpacity={0.7}>
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.scanButtonText}>ADD</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Server Status Hint */}
        <View style={styles.hintSection}>
          <Text style={styles.hintIcon}>🔗</Text>
          <Text style={styles.hintText}>
            Connected to live backend — enter any barcode from your database
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}




function createStyles(isDark: boolean) {
  const bg = isDark ? '#0A0A1A' : '#F5F5FA';
  const cardBg = isDark ? '#141428' : '#FFFFFF';
  const textPrimary = isDark ? '#EAEAFF' : '#1A1A2E';
  const textSecondary = isDark ? '#7A7A9A' : '#8888AA';
  const accent = '#6C63FF';
  const accentGlow = isDark ? 'rgba(108, 99, 255, 0.15)' : 'rgba(108, 99, 255, 0.08)';
  const border = isDark ? '#1E1E3A' : '#E8E8F0';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: bg,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 30,
    },

    // Header
    header: {
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 24,
    },
    logoText: {
      fontSize: 40,
      marginBottom: 4,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: textPrimary,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 14,
      color: textSecondary,
      marginTop: 4,
    },

    // Cart Pill
    cartPill: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: cardBg,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: border,
      // Shadow
      shadowColor: accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    cartPillLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    cartPillIcon: {
      fontSize: 22,
    },
    cartPillCount: {
      fontSize: 16,
      fontWeight: '600',
      color: textPrimary,
    },
    cartPillTotal: {
      fontSize: 22,
      fontWeight: '800',
      color: accent,
      letterSpacing: -0.5,
    },

    // Success Toast
    successToast: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(34, 197, 94, 0.12)',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: 'rgba(34, 197, 94, 0.25)',
    },
    successIcon: {
      fontSize: 16,
      color: '#22C55E',
      fontWeight: '700',
    },
    successText: {
      fontSize: 14,
      color: '#22C55E',
      fontWeight: '600',
    },

    // Input Section
    inputSection: {
      marginBottom: 28,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: textSecondary,
      letterSpacing: 1.5,
      marginBottom: 8,
      marginLeft: 4,
    },
    inputRow: {
      flexDirection: 'row',
      gap: 10,
    },
    input: {
      flex: 1,
      backgroundColor: cardBg,
      borderRadius: 14,
      paddingHorizontal: 18,
      paddingVertical: 16,
      fontSize: 16,
      color: textPrimary,
      borderWidth: 1.5,
      borderColor: border,
      fontWeight: '500',
    },
    scanButton: {
      backgroundColor: accent,
      borderRadius: 14,
      paddingHorizontal: 24,
      justifyContent: 'center',
      alignItems: 'center',
      // Glow effect
      shadowColor: accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    scanButtonDisabled: {
      opacity: 0.6,
    },
    scanButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 1,
    },

    // Server Hint
    hintSection: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: accentGlow,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(108, 99, 255, 0.2)' : 'rgba(108, 99, 255, 0.12)',
    },
    hintIcon: {
      fontSize: 18,
    },
    hintText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '500',
      color: textSecondary,
      lineHeight: 18,
    },
  });
}
