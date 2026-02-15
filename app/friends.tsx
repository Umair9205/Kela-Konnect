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

  const handleRemove = async (friendId: string) => {
    const friend = friends.find(f => f.id === friendId);
    if (!friend) return;

    Alert.alert(
      'Remove Friend?',
      `Remove ${friend.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFriend(friendId)
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>👥 Friends</Text>

      <TouchableOpacity 
        style={styles.qrButton}
        onPress={() => router.push('/qr-code')}
      >
        <Text style={styles.qrButtonText}>📱 Show My QR Code</Text>
      </TouchableOpacity>

      <Text style={styles.subtitle}>
        Your Friends ({friends.length}):
      </Text>

      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.friendItem}>
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>👤 {item.name}</Text>
              <Text style={styles.friendId}>ID: {item.id}</Text>
              <Text style={styles.friendDate}>
                Added: {new Date(item.addedDate).toLocaleDateString()}
              </Text>
            </View>
            
            <View style={styles.friendActions}>
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => router.push({
                  pathname: '/call',
                  params: { friendId: item.id, friendName: item.name }
                })}
              >
                <Text style={styles.callButtonText}>📞</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemove(item.id)}
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
              Add friends by scanning their QR codes
            </Text>
          </View>
        }
        style={styles.list}
      />

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 You can only call users in your friends list
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
  qrButton: {
    backgroundColor: '#FF9800',
    padding: 18,
    borderRadius: 12,
    marginBottom: 30,
    elevation: 2,
  },
  qrButtonText: {
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
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
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
    backgroundColor: '#4CAF50',
    width: 50,
    height: 50,
    borderRadius: 25,
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