import React from "react";
import { View, Text, Image, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { If } from "jsx-control-statements";

const MyHorsesScreen = () => {
  return (
    <View>
      <SafeAreaView style={styles.top_bar}>
        <Text style={styles.header}>My horses</Text>
      </SafeAreaView>
      <ScrollView style={styles.viewPort}>
        <If></If>
        <View style={styles.line}></View>
        {data.map((u, i) => {
          return (
            <View style={styles.card} key={i}>
              <Image
                style={styles.horseImage}
                resizeMode="cover"
                source={u.img}
              />
              <View style={styles.cardInfo}>
                <Text>{u.name}</Text>
                <Text>Gender: {u.gender}</Text>
                <Text>Age: {u.age}</Text>
                <Text>Height: {u.height}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
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
    img: require("../../assets/images/horses/falko.png"),
  },
];

const styles = StyleSheet.create({
  top_bar: {
    backgroundColor: "#335C67",
    height: "18%",
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    marginTop: -4,
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
    width: "90%",
    height: 200,
    marginTop: 20,
    marginLeft: "auto",
    marginRight: "auto",
    backgroundColor: "#669BBC",
    borderRadius: 25,
    paddingTop: 10,
    paddingBottom: 10,
    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 8,

    flex: 1,
    flexDirection: "row",
  },
  horseImage: {
    width: 98,
    height: 150,
    borderRadius: 10,
    marginLeft: 10,
    marginTop: "auto",
    marginBottom: "auto",
  },
  cardInfo: {
    backgroundColor: "#708D81",
    borderRadius: 15,
    width: "65%",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: "auto",
    marginRight: "auto",
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
