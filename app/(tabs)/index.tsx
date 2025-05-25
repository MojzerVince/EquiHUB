import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@rneui/themed";

const MyHorsesScreen = () => {
  return (
    <View>
      <SafeAreaView style={styles.top_bar}>
        <Text style={styles.header}>My horses</Text>
      </SafeAreaView>
      <View style={styles.viewPort}>
        <Text style={styles.saved}>You have x horses saved</Text>
        <View style={styles.line}></View>
        <Card></Card>
      </View>
    </View>
    /*<View style={styles.container}>
      <Text style={styles.header}>My Horses</Text>
      <Text style={styles.subHeader}>You have x horses saved</Text>
      
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <Image
            source={{ uri: 'https://example.com/horse.jpg' }} // Replace with actual image URL
            style={styles.horseImage}
          />
          <View style={styles.infoContainer}>
            <Text style={styles.horseName}>Favory Falkó</Text>
            <View style={styles.detailsRow}>
              <Text style={styles.detail}>Gender: Gelding</Text>
              <Text style={styles.detail}>Age: 12</Text>
            </View>
            <Text style={styles.detail}>Height: 168cm</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.editButton}>
                <Text style={styles.buttonText}>Edit Horse</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.archiveButton}>
                <Text style={styles.buttonText}>Archive Horse</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <Text style={styles.navItem}>👤</Text>
        <Text style={styles.navItem}>📘</Text>
        <Text style={styles.navItem}>➕</Text>
        <Text style={styles.navItem}>🏇</Text>
        <Text style={styles.navItem}>🛒</Text>
        <Text style={styles.navItem}>✏️</Text>
      </View>
    </View>*/
  );
};

const data = [
  {
    name: "Favory Falkó",
    gender: "Gelding",
    age: 12,
    height: 168,
    img: "../assets/images/horses/falko.png",
  },
];

const styles = StyleSheet.create({
  top_bar: {
    backgroundColor: "#335C67",
    height: "20%",
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    marginTop: 10,
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    height: "100%",
    marginTop: -80,
    borderRadius: 50,
  },
  saved: {
    fontSize: 25,
    fontFamily: "Inder",
    color: "#000000",
    textAlign: "center",
    marginTop: 20,
  },
  line: {
    height: 4,
    width: "90%",
    marginLeft: "auto",
    marginRight: "auto",
    backgroundColor: "#D9D9D9",
    marginTop: 20,
  },
  card: {
    backgroundColor: "#d4e4e4",
    borderRadius: 15,
    flexDirection: "row",
    padding: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  horseImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  infoContainer: {
    marginLeft: 10,
    flex: 1,
  },
  horseName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#235B5E",
    marginBottom: 5,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detail: {
    fontSize: 14,
    color: "#333",
  },
  buttonRow: {
    flexDirection: "row",
    marginTop: 10,
    justifyContent: "space-between",
  },
  editButton: {
    backgroundColor: "#b1d0d0",
    padding: 6,
    borderRadius: 6,
  },
  archiveButton: {
    backgroundColor: "#97b7b7",
    padding: 6,
    borderRadius: 6,
  },
  buttonText: {
    fontSize: 12,
    color: "#000",
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#1e5b5f",
    paddingVertical: 10,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  navItem: {
    fontSize: 24,
    color: "#fff",
  },
});

export default MyHorsesScreen;
