import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function AlertStuff(text: any, text2: any) {
  Alert.alert(text, text2);
}

const MyHorsesScreen = () => {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>My Horses</Text>
        </View>
      </SafeAreaView>

      <View style={styles.viewPort}>
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.horsesContainer}>
            <View style={styles.statsHeader}>
              <Text style={styles.statsText}>You have {data.length} horses</Text>
            </View>
            
            {data.map((horse, index) => (
              <View style={styles.horseCard} key={horse.id}>
                <View style={styles.horseImageContainer}>
                  <Image
                    style={styles.horseImage}
                    resizeMode="cover"
                    source={horse.img}
                  />
                </View>
                
                <View style={styles.horseContent}>
                  <View style={styles.horseInfo}>
                    <Text style={styles.horseName}>{horse.name}</Text>
                    <View style={styles.horseDetails}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Gender:</Text>
                        <Text style={styles.detailValue}>{horse.gender}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Born:</Text>
                        <Text style={styles.detailValue}>{horse.year}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Height:</Text>
                        <Text style={styles.detailValue}>{horse.height} cm</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Breed:</Text>
                        <Text style={styles.detailValue}>{horse.breed}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton]}
                      onPress={() => AlertStuff("Edit Horse", `Edit ${horse.name}`)}
                    >
                      <Text style={styles.editButtonText}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => AlertStuff("Delete Horse", `Delete ${horse.name}?`)}
                    >
                      <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
            
            {data.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateEmoji}>🐴</Text>
                <Text style={styles.emptyStateText}>No horses yet!</Text>
                <Text style={styles.emptyStateSubtext}>
                  Add your first horse to get started.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const data = [
  {
    id: 0,
    name: "Favory Falkó",
    gender: "Gelding",
    year: 2012,
    height: 168,
    breed: "Lipicai",
    img: require("../../assets/images/horses/falko.png"),
  },
  {
    id: 1,
    name: "Yamina",
    gender: "Mare", //többnek kell lennie mint 3 karakter, különben szétkúrja a flexboxot
    year: 2018,
    height: 160,
    breed: "Magyar Sportló",
    img: require("../../assets/images/horses/yamina.png"),
  },
  {
    id: 2,
    name: "Random1",
    gender: "Random1",
    year: 2000,
    height: 99,
    breed: "Shitlandi póni",
    img: require("../../assets/images/horses/pony.jpg"),
  },
  {
    id: 3,
    name: "Random2",
    gender: "Random2",
    year: 1999,
    height: 200,
    breed: "Random2",
    img: require("../../assets/images/horses/random2.jpg"),
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#335C67",
  },
  safeArea: {
    backgroundColor: "#335C67",
    paddingBottom: 5,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: -20,
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    flex: 1,
    fontWeight: "600",
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: 5,
    paddingTop: 30,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  horsesContainer: {
    paddingHorizontal: 20,
  },
  statsHeader: {
    alignItems: "center",
    marginBottom: 30,
    backgroundColor: "#E9F5F0",
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  statsText: {
    fontSize: 18,
    fontFamily: "Inder",
    color: "#335C67",
    fontWeight: "600",
  },
  horseCard: {
    backgroundColor: "#E9F5F0",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  horseImageContainer: {
    alignItems: "center",
    marginBottom: 15,
  },
  horseImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#335C67",
  },
  horseContent: {
    flex: 1,
  },
  horseInfo: {
    marginBottom: 20,
  },
  horseName: {
    fontSize: 24,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#335C67",
    textAlign: "center",
    marginBottom: 15,
  },
  horseDetails: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  detailLabel: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#666",
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#335C67",
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 15,
    alignItems: "center",
  },
  editButton: {
    backgroundColor: "#335C67",
  },
  deleteButton: {
    backgroundColor: "#FF6B6B",
  },
  editButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyStateText: {
    fontSize: 24,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 10,
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
  },
});

export default MyHorsesScreen;
