<template>
  <v-container fluid class="plugin-main">
    <div>hello translime</div>

    <div>
      <v-btn>vuetify button</v-btn>
    </div>
  </v-container>
</template>

<script>
const vuetify = window.vuetify$.components;

export default {
  name: 'ui',

  components: {
    ...vuetify,
  },
};
</script>
