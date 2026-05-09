import React from 'react'; import {SafeAreaView, View, Text, StyleSheet} from 'react-native'; import {colors} from '@/theme/colors';
export const AppScaffold=({title,children}:{title:string;children:React.ReactNode})=><SafeAreaView style={s.root}><Text style={s.title}>{title}</Text><View style={s.body}>{children}</View></SafeAreaView>;
const s=StyleSheet.create({root:{flex:1,backgroundColor:colors.bg,padding:16},title:{color:colors.text,fontSize:24,fontWeight:'700',marginBottom:12},body:{flex:1}});
