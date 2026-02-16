import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppStore } from '../store/appStore';

export default function FriendsScreen() {
  const friends = useAppStore(state => state.friends);
  const removeFriend = useAppStore(state => state.removeFriend);
  const loadFriends = useAppStore(state => state.loadFriends);

  useEffect(() => {
    loadFriends();
  }, []);

  const handleRemove = async (bleAddress: string) => {
    const friend = friends.find(f => f.bleAddress === bleAddress);
    if (!friend) return;

    Alert.alert(
      'Remove Friend?',
      `Remove ${friend.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFriend(bleAddress)
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>👥 Friends</Text>

      <TouchableOpacity 
        style={styles.scanButton}
        onPress={() => router.push('/ble-test')}
      >
        <Text style={styles.scanButtonText}>🔍 Scan for Users</Text>
      </TouchableOpacity>

      <Text style={styles.subtitle}>
        Your Friends ({friends.length}):
      </Text>

      <FlatList
        data={friends}
        keyExtractor={(item) => item.bleAddress}
        renderItem={({ item }) => (
          <View style={styles.friendItem}>
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>👤 {item.name}</Text>
              <Text style={styles.friendId}>BLE: {item.bleAddress}</Text>
              <Text style={styles.friendDate}>
                Added: {new Date(item.addedDate).toLocaleDateString()}
              </Text>
            </View>
            
            <View style={styles.friendActions}>
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => router.push({
                  pathname: '/call',
                  params: { 
                    friendId: item.bleAddress,  // Pass BLE MAC address
                    friendName: item.name 
                  }
                })}
              >
                <Text style={styles.callButtonText}>📞</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemove(item.bleAddress)}
              >
                <Text style={styles.removeButtonText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>
              No friends yet!{'\n\n'}
              Scan for nearby users and add them
            </Text>
          </View>
        }
        style={styles.list}
      />

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Scan → Add Friends → Call Them!
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 40,
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  scanButton: {
    backgroundColor: '#2196F3',
    padding: 18,
    borderRadius: 12,
    marginBottom: 30,
    elevation: 2,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  list: {
    flex: 1,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    elevation: 2,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  friendId: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
  friendDate: {
    fontSize: 11,
    color: '#bbb',
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  callButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  callButtonText: {
    fontSize: 24,
  },
  removeButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    lineHeight: 24,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});