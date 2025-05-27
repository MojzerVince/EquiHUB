import React from "react";
import { View, Text, Image, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const MyHorsesScreen = () => {
  return (
    <View>
      <SafeAreaView style={styles.top_bar}>
        <Text style={styles.header}>My horses</Text>
      </SafeAreaView>
      <ScrollView style={styles.viewPort}>
        <Text style={styles.saved}>You have {data.length} saves</Text>
        <View style={styles.line}></View>
        {data.map((u, i) => {
          return (
            <View style={styles.card} key={i}>
              <Image
                style={styles.horseImage}
                resizeMode="cover"
                source={u.img}
                width={98}
                height={150}
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
    </View>
    /*<View style={styles.bottomNav}>
        <Text style={styles.navItem}>👤</Text>
        <Text style={styles.navItem}>📘</Text>
        <Text style={styles.navItem}>➕</Text>
        <Text style={styles.navItem}>🏇</Text>
        <Text style={styles.navItem}>🛒</Text>
        <Text style={styles.navItem}>✏️</Text>
      </View>*/
  );
};

const data = [
  {
    name: "Favory Falkó",
    gender: "Gelding",
    age: 12,
    height: 168,
    type: "Lili mondta but idk",
    img: require("../../assets/images/horses/falko.png"),
  },
  {
    name: "Yamina",
    gender: "IDKIDK", //többnek kell lennie mint 3 karakter, különben szétkúrja a flexboxot
    age: 8,
    height: 160,
    type: "Magyar Sportló",
    img: require("../../assets/images/horses/yamina.png"),
  },
  {
    name: "Random1",
    gender: "Random1",
    age: 99,
    height: 99,
    type: "Shitlandi póni",
    img: require("../../assets/images/horses/pony.jpg"),
  },
  {
    name: "Random2",
    gender: "Random2",
    age: 0,
    height: 200,
    type: "Random2",
    img: require("../../assets/images/horses/random2.jpg"),
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
    paddingTop: 6,
    paddingBottom: 6,

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

    shadowOffset: {
      width: 8,
      height: 8,
    },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 7,
  },
  cardInfo: {
    backgroundColor: "#708D81",
    borderRadius: 15,
    width: 238,
    height: "70%",
    marginLeft: 10,
    marginRight: -10,

    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  cardName: {
    color: "#FFFFFF",
    textDecorationLine: "underline",
    fontSize: 26,
    marginLeft: 8,
    marginBottom: 6,
    fontFamily: "Inder",
  },
  cardGender: {
    color: "#FFFFFF",
    fontSize: 16,
    marginLeft: 8,
    fontFamily: "Inder",
  },
  cardAge: {
    color: "#FFFFFF",
    fontSize: 16,
    marginLeft: 8,
    fontFamily: "Inder",
  },
  cardHeight: {
    color: "#FFFFFF",
    fontSize: 16,
    marginLeft: 8,
    fontFamily: "Inder",
  },
  cardType: {
    color: "#FFFFFF",
    fontSize: 16,
    marginLeft: 8,
    marginBottom: 4,
    fontFamily: "Inder",
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
