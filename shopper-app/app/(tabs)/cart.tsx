import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore, useCartTotal, useCartItemCount, CartItem } from '@/store/cart-store';

export default function CartScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);

  const items = useCartStore((s) => s.items);
  const total = useCartTotal();
  const itemCount = useCartItemCount();
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);

  const handleClearCart = () => {
    Alert.alert('Clear Cart', 'Remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearCart },
    ]);
  };

  const handleCheckout = () => {
    Alert.alert(
      'Checkout',
      `Total: $${total.toFixed(2)}\n\nPayment simulation coming in Task 2!`,
      [{ text: 'OK' }]
    );
  };

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemLeft}>
        <Text style={styles.cartItemEmoji}>
          {getCategoryEmoji(item.product.category)}
        </Text>
        <View style={styles.cartItemInfo}>
          <Text style={styles.cartItemName}>{item.product.name}</Text>
          <Text style={styles.cartItemCategory}>{item.product.category}</Text>
          <Text style={styles.cartItemBarcode}>{item.product.barcode}</Text>
        </View>
      </View>
      <View style={styles.cartItemRight}>
        <Text style={styles.cartItemPrice}>
          ${(item.product.price * item.quantity).toFixed(2)}
        </Text>
        <View style={styles.quantityRow}>
          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() =>
              updateQuantity(item.product.barcode, item.quantity - 1)
            }
            activeOpacity={0.7}>
            <Text style={styles.qtyButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() =>
              updateQuantity(item.product.barcode, item.quantity + 1)
            }
            activeOpacity={0.7}>
            <Text style={styles.qtyButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Remove Item',
              `Remove ${item.product.name}?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => removeItem(item.product.barcode),
                },
              ]
            );
          }}
          activeOpacity={0.7}>
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your Cart</Text>
          <Text style={styles.subtitle}>
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </Text>
        </View>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearCart} activeOpacity={0.7}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Cart Items */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>Cart is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Scan a barcode or use the demo products to get started
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.product.barcode}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          {/* Checkout Footer */}
          <View style={styles.footer}>
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Subtotal</Text>
              <Text style={styles.footerValue}>
              ${total.toFixed(2)}
              </Text>
            </View>
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Tax (est.)</Text>
              <Text style={styles.footerValue}>
                ${(total * 0.08).toFixed(2)}
              </Text>
            </View>
            <View style={styles.footerDivider} />
            <View style={styles.footerRow}>
              <Text style={styles.footerTotal}>Total</Text>
              <Text style={styles.footerTotalValue}>
                ${(total * 1.08).toFixed(2)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.checkoutButton}
              onPress={handleCheckout}
              activeOpacity={0.8}>
              <Text style={styles.checkoutButtonText}>
                Proceed to Checkout
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    Dairy: '🥛',
    Snacks: '🍫',
    Beverages: '☕',
    Bakery: '🍞',
    Grains: '🍚',
    Oils: '🫒',
  };
  return map[category] ?? '📦';
}

function createStyles(isDark: boolean) {
  const bg = isDark ? '#0A0A1A' : '#F5F5FA';
  const cardBg = isDark ? '#141428' : '#FFFFFF';
  const textPrimary = isDark ? '#EAEAFF' : '#1A1A2E';
  const textSecondary = isDark ? '#7A7A9A' : '#8888AA';
  const accent = '#6C63FF';
  const border = isDark ? '#1E1E3A' : '#E8E8F0';
  const danger = '#EF4444';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: bg,
    },

    // Header
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 16,
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
      marginTop: 2,
    },
    clearText: {
      fontSize: 14,
      fontWeight: '600',
      color: danger,
    },

    // Empty State
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyEmoji: {
      fontSize: 64,
      marginBottom: 16,
      opacity: 0.5,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: textPrimary,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },

    // Cart Items
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    cartItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: cardBg,
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: border,
    },
    cartItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    cartItemEmoji: {
      fontSize: 28,
    },
    cartItemInfo: {
      flex: 1,
    },
    cartItemName: {
      fontSize: 15,
      fontWeight: '700',
      color: textPrimary,
      marginBottom: 2,
    },
    cartItemCategory: {
      fontSize: 12,
      color: textSecondary,
      fontWeight: '500',
    },
    cartItemBarcode: {
      fontSize: 10,
      color: textSecondary,
      fontFamily: 'monospace',
      marginTop: 2,
      opacity: 0.7,
    },

    cartItemRight: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 6,
    },
    cartItemPrice: {
      fontSize: 16,
      fontWeight: '800',
      color: accent,
    },
    quantityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    qtyButton: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: isDark ? '#1E1E3A' : '#F0F0F5',
      justifyContent: 'center',
      alignItems: 'center',
    },
    qtyButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: textPrimary,
    },
    qtyText: {
      fontSize: 15,
      fontWeight: '700',
      color: textPrimary,
      minWidth: 20,
      textAlign: 'center',
    },
    removeText: {
      fontSize: 11,
      fontWeight: '600',
      color: danger,
    },

    // Footer
    footer: {
      backgroundColor: cardBg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 30,
      borderWidth: 1,
      borderColor: border,
      borderBottomWidth: 0,
      // Shadow
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 8,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    footerLabel: {
      fontSize: 14,
      color: textSecondary,
      fontWeight: '500',
    },
    footerValue: {
      fontSize: 14,
      color: textPrimary,
      fontWeight: '600',
    },
    footerDivider: {
      height: 1,
      backgroundColor: border,
      marginVertical: 10,
    },
    footerTotal: {
      fontSize: 18,
      fontWeight: '800',
      color: textPrimary,
    },
    footerTotalValue: {
      fontSize: 18,
      fontWeight: '800',
      color: accent,
    },
    checkoutButton: {
      backgroundColor: accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 16,
      // Glow
      shadowColor: accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 5,
    },
    checkoutButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
  });
}
