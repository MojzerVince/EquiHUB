import React from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function AlertStuff(text: any) {
  Alert.alert(text);
}

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
              <View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{u.name}</Text>
                  <Text style={styles.cardGender}>Gender: {u.gender}</Text>
                  <Text style={styles.cardAge}>Age: {u.age}</Text>
                  <Text style={styles.cardHeight}>Height: {u.height}</Text>
                  <Text style={styles.cardBreed}>Breed: {u.breed}</Text>
                </View>
                <View>
                  <TouchableOpacity
                    style={styles.cardEditButton}
                    onPress={() => AlertStuff("Edit Button")}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontFamily: "Inder",
                        fontSize: 18,
                        textAlign: "center",
                      }}
                    >
                      Edit Horse
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cardDeleteButton}
                    onPress={() => AlertStuff("Delete Button")}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontFamily: "Inder",
                        fontSize: 18,
                        textAlign: "center",
                      }}
                    >
                      Delete Horse
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
        <View style={styles.bottom}></View>
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
    breed: "Lipicai",
    img: require("../../assets/images/horses/falko.png"),
  },
  {
    name: "Yamina",
    gender: "Mare", //többnek kell lennie mint 3 karakter, különben szétkúrja a flexboxot
    age: 8,
    height: 160,
    breed: "Magyar Sportló",
    img: require("../../assets/images/horses/yamina.png"),
  },
  {
    name: "Random1",
    gender: "Random1",
    age: 99,
    height: 99,
    breed: "Shitlandi póni",
    img: require("../../assets/images/horses/pony.jpg"),
  },
  {
    name: "Random2",
    gender: "Random2",
    age: 0,
    height: 200,
    breed: "Random2",
    img: require("../../assets/images/horses/random2.jpg"),
  },
];

const styles = StyleSheet.create({
  top_bar: {
    backgroundColor: "#335C67",
    height: "16%",
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
    marginTop: 14,
  },
  line: {
    height: 4,
    width: "90%",
    marginLeft: "auto",
    marginRight: "auto",
    backgroundColor: "#D9D9D9",
    marginTop: 10,
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
  cardBreed: {
    color: "#FFFFFF",
    fontSize: 16,
    marginLeft: 8,
    marginBottom: 4,
    fontFamily: "Inder",
  },
  cardEditButton: {
    backgroundColor: "#708D81",
    width: "80%",
    marginLeft: "auto",
    marginRight: "auto",
    marginTop: 5,
    marginBottom: 8,
    borderRadius: 10,

    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  cardDeleteButton: {
    backgroundColor: "#708D81",
    width: "80%",
    marginLeft: "auto",
    marginRight: "auto",
    marginBottom: 5,
    borderRadius: 10,

    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  bottom: {
    marginTop: 16,
    height: 164,
    backgroundColor: "#FFFFFF",
  },
});

export default MyHorsesScreen;
